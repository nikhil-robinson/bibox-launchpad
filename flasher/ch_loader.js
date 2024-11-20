// import { UsbTransport } from "./transport_handler";
// import { Protocol } from "./protocol_handler";
import * as transport_handler from "./transport_handler.js";
import * as protocol_handler from "./protocol_handler.js";

// import chipData_0x21 from "./target/0x21-CH32V00x.json";
// import chipData_0x23 from "./target/0x23-CH32X03x.json";
// import chipData_0x22 from "./target/0x22-CH59x.json";
// import chipData_0x24 from "./target/0x24-CH643.json";
import chipData_0x21 from './target/0x21-CH32V00x.json' with { type: "json" };
import chipData_0x22 from './target/0x22-CH59x.json' with { type: "json" };
import chipData_0x23 from './target/0x23-CH32X03x.json' with { type: "json" };
import chipData_0x24 from './target/0x24-CH643.json' with { type: "json" };

export class CH_loader extends transport_handler.UsbTransport {
    /// All readable and writable registers.
    /// - `RDPR`: Read Protection
    /// - `USER`: User Config Byte (normally in Register Map datasheet)
    /// - `WPR`:  Write Protection Mask, 1=unprotected, 0=protected
    ///
    /// | BYTE0  | BYTE1  | BYTE2  | BYTE3  |
    /// |--------|--------|--------|--------|
    /// | RDPR   | nRDPR  | USER   | nUSER  |
    /// | DATA0  | nDATA0 | DATA1  | nDATA1 |
    /// | WPR0   | WPR1   | WPR2   | WPR3   |
    static CFG_MASK_RDPR_USER_DATA_WPR = 0x07;
    static CFG_MASK_BTVER = 0x08;
    static CFG_MASK_UID = 0x10;
    static CFG_MASK_CODE_FLASH_PROTECT = 0x20;
    static CFG_MASK_ALL = 0x1f;
    SECTOR_SIZE = 1024;
    device_type = null;
    chip_id = null;
    chip_uid = new Uint8Array(8);
    code_flash_protected = null;
    btver = new Uint8Array(4);
    flash_size = null;
    protocol = new protocol_handler.Protocol();
    espLoaderTerminal;
    constructor(device, espLoaderTerminal) {
        super(device);
        this.espLoaderTerminal = espLoaderTerminal;
    }
    supportCodeFlashProtect() {
        if (!this.device_type)
            return false;
        return [0x14, 0x15, 0x17, 0x18, 0x19, 0x20].includes(this.device_type);
    }
    minEraseSectorNumber() {
        if (this.device_type === 0x10) {
            return 4;
        }
        else {
            return 8;
        }
    }
    xorKey() {
        if (this.chip_id == null)
            throw new Error("Chip ID not found");
        // Calculate the checksum by adding up all the bytes in chipUid
        const checksum = this.chip_uid.reduce((acc, x) => acc + x, 0) & 0xff; // Ensure it's within u8 range
        // Create a key array filled with the checksum
        const key = new Uint8Array(8).fill(checksum);
        // Modify the last element of the key by adding the chipId and ensure it stays within u8 range
        key[7] = (key[7] + this.chip_id) & 0xff;
        return key;
    }
    async findDevice() {
        // CH_loader.clearLog();
        this.espLoaderTerminal.clean();
        //Identify Device
        const command1 = { type: "Identify", deviceId: 0, deviceType: 0 };
        const sendData1 = await this.protocol.ntoRaw(command1);
        this.sendRaw(sendData1);
        const res = await this.recv();
        if (res.type == "Err")
            throw new Error("Error in finding device");
        this.device_type = res.data[1];
        this.chip_id = res.data[0];
        //Display Device Series and Chip
        /* The commented out switch statement in the `findDevice` method is attempting to determine the
      appropriate `chipData` based on the `device_type` obtained during the device identification
      process. */
        let chipData;
        switch (this.device_type) {
            case 0x21:
                chipData = chipData_0x21;
                break;
            case 0x22:
                chipData = chipData_0x22;
                break;
            case 0x23:
                chipData = chipData_0x23;
                break;
            case 0x24:
                chipData = chipData_0x24;
                break;
            default:
                throw new Error("Device not supported");
        }
        if (chipData.device_type == "0x" + this.device_type.toString(16)) {
            // CH_loader.debugLog("Device Series : " + chipData.name);
            this.espLoaderTerminal.writeLine("Device Series : " + chipData.name);
        }
        chipData.variants.forEach((variant) => {
            if (variant.chip_id == this.chip_id) {
                this.flash_size = variant.flash_size;
                // CH_loader.debugLog("Chip : " + variant.name);
                /* The `variant` in the `findDevice` method is iterating over the variants
                  of the chip data to find a match with the current chip ID. It is used to
                  retrieve specific information about the chip variant based on the chip
                  ID obtained from the device. If a matching variant is found, it sets the
                  flash size and logs information about the chip variant such as the name
                  and flash size in KiB. */
                // CH_loader.debugLog(
                //   "Flash Size : " + variant.flash_size / 1024 + " KiB"
                // );
                this.espLoaderTerminal.writeLine("Chip : " + variant.name);
                this.espLoaderTerminal.writeLine("Flash Size : " + variant.flash_size / 1024 + " KiB");
            }
        });
        //Read Config
        const command2 = {
            type: "ReadConfig",
            bitMask: CH_loader.CFG_MASK_ALL,
        };
        const sendData2 = await this.protocol.ntoRaw(command2);
        this.sendRaw(sendData2);
        const res2 = await this.recv();
        if (res2.type == "Err")
            throw new Error("Error in finding config");
        //check if code flash is protected
        this.code_flash_protected =
            this.supportCodeFlashProtect() && res2.data[2] != 0xa5;
        // CH_loader.debugLog("Code Flash Protected : " + this.code_flash_protected);
        this.espLoaderTerminal.writeLine("Code Flash Protected : " + this.code_flash_protected);
        //get the bootloader version
        this.btver.set(res2.data.slice(14, 18));
        // CH_loader.debugLog(
        //   "Bootloader Version (BTVER) : " +
        //     this.btver[0] +
        //     "" +
        //     this.btver[1] +
        //     "." +
        //     this.btver[2] +
        //     "" +
        //     this.btver[3]
        // );
        this.espLoaderTerminal.writeLine("Bootloader Version (BTVER) : " +
            this.btver[0] +
            "" +
            this.btver[1] +
            "." +
            this.btver[2] +
            "" +
            this.btver[3]);
        //get the chip UID
        this.chip_uid.set(res2.data.slice(18));
        // CH_loader.debugLog(
        //   "Chip UID : " +
        //     Array.from(this.chip_uid)
        //       .map((x) => x.toString(16).padStart(2, "0").toUpperCase())
        //       .join("-")
        // );
        this.espLoaderTerminal.writeLine("Chip UID : " +
            Array.from(this.chip_uid)
                .map((x) => x.toString(16).padStart(2, "0").toUpperCase())
                .join("-"));
        //get the user config byte
        this.dumpInfo(res2, chipData);
    }
    async dumpInfo(res, chipData) {
        const raw = res.data.slice(2);
        if (!chipData.config_registers)
            return;
        chipData.config_registers.forEach((config) => {
            let n = new DataView(raw.buffer, raw.byteOffset + Number(config.offset), //reg_def.offset,
            4).getUint32(0, true);
            // CH_loader.debugLog(config.name + " : 0x" + n.toString(16));
            this.espLoaderTerminal.writeLine(config.name + " : 0x" + n.toString(16));
            if (config.fields) {
                config.fields.forEach((fieldDef) => {
                    let bitWidth = fieldDef.bit_range[0] - fieldDef.bit_range[1] + 1;
                    let b = (n >>> fieldDef.bit_range[1]) & ((1 << bitWidth) - 1);
                    // CH_loader.debugLog(
                    //   `[${fieldDef.bit_range[0]}, ${fieldDef.bit_range[1]}] ${
                    //     fieldDef.name
                    //   }  0x${b.toString(16)} (0b${b.toString(2)})`
                    // );
                    this.espLoaderTerminal.writeLine(`[${fieldDef.bit_range[0]}, ${fieldDef.bit_range[1]}] ${fieldDef.name}  0x${b.toString(16)} (0b${b.toString(2)})`);
                    if ("explaination" in fieldDef && fieldDef.explaination) {
                        for (const [key, value] of Object.entries(fieldDef.explaination)) {
                            if (b == Number(key)) {
                                // CH_loader.debugLog(` - ${value}`);
                                this.espLoaderTerminal.writeLine(` - ${value}`);
                            }
                        }
                    }
                });
            }
        });
    }
    async eraseCode(sectors) {
        const command = { type: "Erase", sectors: sectors };
        const sendData = await this.protocol.ntoRaw(command);
        console.log("erase send data", sendData);
        this.sendRaw(sendData);
        const res = await this.recv();
        if (res.type == "Err")
            throw new Error("Error in erasing code");
        // else CH_loader.debugLog(`Erased ${sectors} code flash sectors`);
        else
            this.espLoaderTerminal.writeLine(`Erased ${sectors} code flash sectors`);
    }
    async eraseFlash(flash_size = this.flash_size) {
        if (!this.flash_size) {
            await this.findDevice();
            flash_size = this.flash_size;
        }
        if (!flash_size)
            throw new Error("Flash size not found");
        let sectors = flash_size / 1024;
        const minSectors = this.minEraseSectorNumber();
        if (sectors < minSectors) {
            sectors = minSectors;
            // CH_loader.debugLog(
            //   `erase_code: set min number of erased sectors to ${sectors}`
            // );
            this.espLoaderTerminal.writeLine(`erase_code: set min number of erased sectors to ${sectors}`);
        }
        const command = { type: "Erase", sectors: sectors };
        const sendData = await this.protocol.ntoRaw(command);
        this.sendRaw(sendData);
        console.log(sendData);
        const res = await this.recv();
        console.log(res);
        if (res.type == "Err")
            throw new Error("Error in erasing flash");
        else
            this.espLoaderTerminal.writeLine(`Erased ${sectors} code flash sectors`);
        // else CH_loader.debugLog(`Erased ${sectors} code flash sectors`);
    }
    async flashChunk(address, raw, key) {
        // XOR the raw data with the key
        const xored = raw.map((value, index) => value ^ key[index % 8]);
        const padding = Math.floor(Math.random() * 256);
        const command = {
            type: "Program",
            address: address,
            padding: padding,
            data: xored,
        };
        const sendData = await this.protocol.ntoRaw(command);
        await this.sendRaw(sendData);
        await this.sleep(300);
        const res = await this.recv();
        if (res.type == "Err") {
            throw new Error(`Program 0x${address.toString(16).padStart(8, "0")} failed`);
        }
        // CH_loader.debugLog("Programmed 0x" + address.toString(16).padStart(8, "0"));
        // this.espLoaderTerminal.writeLine(
        //   "Programmed 0x" + address.toString(16).padStart(8, "0")
        // );
    }
    //-----------------------------------------------------------------------------
    extendFirmwareToSectorBoundary(buf) {
        const newArray = [...buf];
        if (newArray.length % 1024 !== 0) {
            const remain = 1024 - (newArray.length % 1024);
            newArray.push(...new Array(remain).fill(0));
        }
        return newArray;
    }
    mergeSections(sections) {
        sections.sort((a, b) => a.offset - b.offset); // order by start address
        const startAddress = sections[0].offset;
        const endAddress = sections[sections.length - 1].offset +
            sections[sections.length - 1].value.length;
        const totalSize = endAddress - startAddress;
        const binary = new Uint8Array(totalSize);
        // FIXME: check section overlap?
        for (const section of sections) {
            const sectStart = section.offset - startAddress;
            binary.set(section.value, sectStart);
        }
        return binary;
    }
    async readIHex(data) {
        console.log("read intel hex");
        const records = [];
        let baseAddress = 0;
        const lines = data.split("\n");
        for (const line of lines) {
            if (line.startsWith(":")) {
                const record = this.parseIHexRecord(line);
                switch (record.type) {
                    case "00": // Data
                        const offset = baseAddress + record.offset;
                        records.push({ offset, value: record.data });
                        break;
                    case "01": // End Of File
                        break;
                    case "02": // Extended Segment Address
                        baseAddress = record.address * 16;
                        break;
                    case "03": // Start Segment Address
                        break;
                    case "04": // Extended Linear Address
                        baseAddress = record.address << 16;
                        break;
                    case "05": // Start Linear Address
                        break;
                }
            }
        }
        return this.mergeSections(records);
    }
    parseIHexRecord(line) {
        const length = parseInt(line.substr(1, 2), 16);
        const offset = parseInt(line.substr(3, 4), 16);
        const type = line.substr(7, 2);
        const data = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            data[i] = parseInt(line.substr(9 + i * 2, 2), 16);
        }
        const address = parseInt(line.substr(9, 4), 16);
        return { type, offset, data, address };
    }
    //------------------------------------------------------------------
    intelHexToUint8Array(hexString) {
        const lines = hexString.trim().split("\n");
        const data = [];
        lines.forEach((line) => {
            if (line.startsWith(":")) {
                const byteCount = parseInt(line.substr(1, 2), 16);
                const dataStartIndex = 9; // Data starts after 9 characters (: + 2-byte count + 4-byte address + 2-byte record type)
                const dataEndIndex = dataStartIndex + byteCount * 2;
                for (let i = dataStartIndex; i < dataEndIndex; i += 2) {
                    data.push(parseInt(line.substr(i, 2), 16));
                }
            }
        });
        return new Uint8Array(data);
    }
    async flashFirmware(firmware) {
        try {
            // const raw = this.intelHexToUint8Array(firmware);
            const raw = await this.readIHex(firmware);
            const sectors = raw.length / this.SECTOR_SIZE + 1;
            // if (!this.chip_id && !this.chip_uid) await this.findDevice();
            // await this.eraseFlash(sectors);
            if (!this.flash_size)
                await this.findDevice();
            this.espLoaderTerminal.writeLine("Erase Starting ...");
            await this.eraseCode(sectors);
            this.espLoaderTerminal.writeLine("Erase completed ...");
            // CH_loader.debugLog("flashing firmware ...");
            this.espLoaderTerminal.writeLine("flashing firmware ...");
            const key = this.xorKey();
            const keyChecksum = key.reduce((acc, x) => (acc + x) & 0xff, 0);
            console.log("key ", key, keyChecksum);
            const command1 = {
                type: "IspKey",
                key: new Uint8Array(0x1e),
            };
            const sendData1 = await this.protocol.ntoRaw(command1);
            this.sendRaw(sendData1);
            const res = await this.recv();
            if (res.type == "Err")
                throw new Error("isp_key failede");
            if (res.data[0] != keyChecksum)
                throw new Error("isp_key checksum failed");
            console.log("res data", res.data);
            const CHUNK = 56;
            let address = 0x0;
            for (let i = 0; i < raw.length; i += CHUNK) {
                const chunk = raw.subarray(i, i + CHUNK);
                await this.flashChunk(address, chunk, key);
                address += chunk.length;
            }
            await this.flashChunk(address, new Uint8Array(), key);
            // CH_loader.debugLog("firmware flashed");
            this.espLoaderTerminal.writeLine("firmware flashed");
        }
        catch (e) {
            console.log("ERROR", e);
        }
    }
    async reset() {
        try {
            const command = { type: "IspEnd", reason: 1 };
            const sendData = await this.protocol.ntoRaw(command);
            this.sendRaw(sendData);
            const res = await this.recv();
            if (res.type == "Err")
                throw new Error("Error in reset");
            // CH_loader.debugLog("Device Reset");
            this.espLoaderTerminal.writeLine("Device Reset");
        }
        catch (e) {
            console.log("ERROR", e);
        }
    }
}
