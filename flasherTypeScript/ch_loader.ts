import { UsbTransport } from "./transport_handler";
import { Protocol } from "./protocol_handler";
import { Command } from "./types";
import chipData_0x21 from "./target/0x21-CH32V00x.json";
import chipData_0x23 from "./target/0x23-CH32X03x.json";
import chipData_0x22 from "./target/0x22-CH59x.json";
import chipData_0x24 from "./target/0x24-CH643.json";
import { ChipData } from "./types";
import { Response } from "./types";
export class CH_loader extends UsbTransport {
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

  device_type: number | null = null;
  chip_id: number | null = null;
  chip_uid: Uint8Array = new Uint8Array(8);
  code_flash_protected: boolean | null = null;
  btver: Uint8Array = new Uint8Array(4);
  flash_size: number | null = null;

  protocol = new Protocol();
  constructor(device: USBDevice) {
    super(device);
  }
  supportCodeFlashProtect(): boolean {
    if (!this.device_type) return false;
    return [0x14, 0x15, 0x17, 0x18, 0x19, 0x20].includes(this.device_type);
  }
  minEraseSectorNumber(): number {
    if (this.device_type === 0x10) {
      return 4;
    } else {
      return 8;
    }
  }
  xorKey(): Uint8Array {
    if (this.chip_id == null) throw new Error("Chip ID not found");
    // Calculate the checksum by adding up all the bytes in chipUid
    const checksum = this.chip_uid.reduce((acc, x) => acc + x, 0) & 0xff; // Ensure it's within u8 range

    // Create a key array filled with the checksum
    const key = new Uint8Array(8).fill(checksum);

    // Modify the last element of the key by adding the chipId and ensure it stays within u8 range
    key[7] = (key[7] + this.chip_id) & 0xff;

    return key;
  }
  async findDevice() {
    CH_loader.clearLog();
    //Identify Device
    const command1: Command = { type: "Identify", deviceId: 0, deviceType: 0 };
    const sendData1 = await this.protocol.ntoRaw(command1);
    this.sendRaw(sendData1);
    const res = await this.recv();
    if (res.type == "Err") throw new Error("Error in finding device");
    this.device_type = res.data[1];
    this.chip_id = res.data[0];
    //Display Device Series and Chip
    /* The commented out switch statement in the `findDevice` method is attempting to determine the
  appropriate `chipData` based on the `device_type` obtained during the device identification
  process. */
    let chipData: ChipData;
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
    if (chipData.device_type == "0x" + this.device_type.toString(16))
      CH_loader.debugLog("Device Series : " + chipData.name);
    chipData.variants.forEach((variant) => {
      if (variant.chip_id == this.chip_id) {
        this.flash_size = variant.flash_size;
        CH_loader.debugLog("Chip : " + variant.name);
        CH_loader.debugLog(
          "Flash Size : " /* The `variant` in the `findDevice` method is iterating over the variants
          of the chip data to find a match with the current chip ID. It is used to
          retrieve specific information about the chip variant based on the chip
          ID obtained from the device. If a matching variant is found, it sets the
          flash size and logs information about the chip variant such as the name
          and flash size in KiB. */ +
            variant.flash_size / 1024 +
            " KiB"
        );
      }
    });
    //Read Config
    const command2: Command = {
      type: "ReadConfig",
      bitMask: CH_loader.CFG_MASK_ALL,
    };
    const sendData2 = await this.protocol.ntoRaw(command2);
    this.sendRaw(sendData2);
    const res2 = await this.recv();
    if (res2.type == "Err") throw new Error("Error in finding config");
    //check if code flash is protected
    this.code_flash_protected =
      this.supportCodeFlashProtect() && res2.data[2] != 0xa5;
    CH_loader.debugLog("Code Flash Protected : " + this.code_flash_protected);
    //get the bootloader version
    this.btver.set(res2.data.slice(14, 18));
    CH_loader.debugLog(
      "Bootloader Version (BTVER) : " +
        this.btver[0] +
        "" +
        this.btver[1] +
        "." +
        this.btver[2] +
        "" +
        this.btver[3]
    );
    //get the chip UID
    this.chip_uid.set(res2.data.slice(18));
    CH_loader.debugLog(
      "Chip UID : " +
        Array.from(this.chip_uid)
          .map((x) => x.toString(16).padStart(2, "0").toUpperCase())
          .join("-")
    );
    //get the user config byte
    this.dumpInfo(res2, chipData);
  }
  async dumpInfo(res: Response, chipData: ChipData) {
    const raw = res.data.slice(2);
    if (!chipData.config_registers) return;
    chipData.config_registers.forEach((config) => {
      let n: number = new DataView(
        raw.buffer,
        raw.byteOffset + Number(config.offset), //reg_def.offset,
        4
      ).getUint32(0, true);
      CH_loader.debugLog(config.name + " : 0x" + n.toString(16));
      if (config.fields) {
        config.fields.forEach((fieldDef) => {
          let bitWidth: number =
            fieldDef.bit_range[0] - fieldDef.bit_range[1] + 1;
          let b: number = (n >>> fieldDef.bit_range[1]) & ((1 << bitWidth) - 1);
          CH_loader.debugLog(
            `[${fieldDef.bit_range[0]}, ${fieldDef.bit_range[1]}] ${
              fieldDef.name
            }  0x${b.toString(16)} (0b${b.toString(2)})`
          );
          if ("explaination" in fieldDef && fieldDef.explaination) {
            for (const [key, value] of Object.entries(fieldDef.explaination)) {
              if (b == Number(key)) {
                CH_loader.debugLog(` - ${value}`);
              }
            }
          }
        });
      }
    });
  }
  async eraseFlash(flash_size: number | null = this.flash_size) {
    if (!this.flash_size) {
      await this.findDevice();
      flash_size = this.flash_size;
    }

    if (!flash_size) throw new Error("Flash size not found");
    let sectors = flash_size / 1024;
    const minSectors = this.minEraseSectorNumber();
    if (sectors < minSectors) {
      sectors = minSectors;
      CH_loader.debugLog(
        `erase_code: set min number of erased sectors to ${sectors}`
      );
    }
    const command: Command = { type: "Erase", sectors: sectors };
    const sendData = await this.protocol.ntoRaw(command);
    this.sendRaw(sendData);
    console.log(sendData);
    const res = await this.recv();
    console.log(res);
    if (res.type == "Err") throw new Error("Error in erasing flash");
    else CH_loader.debugLog(`Erased ${sectors} code flash sectors`);
  }
  async flashChunk(
    address: number,
    raw: Uint8Array,
    key: Uint8Array
  ): Promise<void> {
    // XOR the raw data with the key
    const xored = raw.map((value, index) => value ^ key[index % 8]);
    const padding = Math.floor(Math.random() * 256);
    const command: Command = {
      type: "Program",
      address: address,
      padding: padding,
      data: xored,
    };
    const sendData = await this.protocol.ntoRaw(command);
    this.sendRaw(sendData);
    const res = await this.recv();
    if (res.type == "Err") {
      throw new Error(
        `Program 0x${address.toString(16).padStart(8, "0")} failed`
      );
    }
    CH_loader.debugLog("Programmed 0x" + address.toString(16).padStart(8, "0"));
  }
  intelHexToUint8Array(hexString: string) {
    const lines = hexString.trim().split("\n");
    const data: Array<number> = [];
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
  async flashFirmware(firmware: string) {
    const raw = this.intelHexToUint8Array(firmware);
    const sectors = raw.length / this.SECTOR_SIZE + 1;
    if (!this.chip_id && !this.chip_uid) await this.findDevice();
    await this.eraseFlash(sectors);
    const key = this.xorKey();
    const keyChecksum = key.reduce((acc, x) => (acc + x) & 0xff, 0);
    console.log("key ", key, keyChecksum);
    const command1: Command = {
      type: "IspKey",
      key: new Uint8Array(0x1e),
    };
    const sendData1 = await this.protocol.ntoRaw(command1);
    this.sendRaw(sendData1);
    const res = await this.recv();
    if (res.type == "Err") throw new Error("isp_key failede");
    if (res.data[0] != keyChecksum) throw new Error("isp_key checksum failed");
    console.log("res data", res.data);
    const CHUNK = 56;
    let address = 0x0;
    for (let i = 0; i < raw.length; i += CHUNK) {
      const chunk = raw.subarray(i, i + CHUNK);
      await this.flashChunk(address, chunk, key);
      address += chunk.length;
    }
    await this.flashChunk(address, new Uint8Array(), key);
    CH_loader.debugLog("firmware flashed");
  }
  async reset() {
    const command: Command = { type: "IspEnd", reason: 1 };
    const sendData = await this.protocol.ntoRaw(command);
    this.sendRaw(sendData);
    const res = await this.recv();
    if (res.type == "Err") throw new Error("Error in reset");
    CH_loader.debugLog("Device Reset");
  }
}
