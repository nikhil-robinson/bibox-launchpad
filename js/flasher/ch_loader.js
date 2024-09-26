// import { UsbTransport } from "./transport_handler";
// import { Protocol } from "./protocol_handler";
// import chipData from "./target/0x23-CH32X03x.json";

// import Protocol from "./protocol_handler";
// import chipData from "./target/chipData";
// import UsbTransport from "./transport_handler";
// extends UsbTransport

// import * as protocolFile from "./protocol_handler";

const chipData = {
  name: "CH32X03x Series",
  mcu_type: "0x13",
  device_type: "0x23",
  support_net: false,
  support_usb: true,
  support_serial: true,
  description: "CH32X03x RISC-V4C Series",
  config_registers: [
    {
      offset: "0x00",
      name: "RDPR_USER",
      description: "RDPR, nRDPR, USER, nUSER",
      reset: "0xFFFF5AA5",
      fields: [
        {
          bit_range: [7, 0],
          name: "RDPR",
          description:
            "Read Protection. 0xA5 for unprotected, otherwise read-protected(ignoring WRP)",
          explaination: {
            "0xa5": "Unprotected",
            _: "Protected",
          },
        },
        {
          bit_range: [16, 16],
          name: "IWDG_SW",
          description: "Independent watchdog (IWDG) hardware enable",
          explaination: {
            1: "IWDG enabled by the software, and disabled by hardware",
            0: "IWDG enabled by the software (decided along with the LSI clock)",
          },
        },
        {
          bit_range: [17, 17],
          name: "STOP_RST",
          description: "System reset control under the stop mode",
          explaination: {
            1: "Disable",
            0: "Enable",
          },
        },
        {
          bit_range: [18, 18],
          name: "STANDBY_RST",
          description:
            "System reset control under the standby mode, STANDY_RST",
          explaination: {
            1: "Disable, entering standby-mode without RST",
            0: "Enable",
          },
        },
        {
          bit_range: [20, 19],
          name: "RST_MOD",
          description: "Reset mode",
          explaination: {
            "0b00": "Enable RST alternative function",
            "0b11":
              "Disable RST alternative function, use PA21/PC3/PB7 as GPIO",
            _: "Error",
          },
        },
      ],
    },
    {
      offset: "0x04",
      name: "DATA",
      description: "Customizable 2 byte data, DATA0, nDATA0, DATA1, nDATA1",
      reset: "0xFF00FF00",
      type: "u32",
      fields: [
        {
          bit_range: [7, 0],
          name: "DATA0",
        },
        {
          bit_range: [23, 16],
          name: "DATA1",
        },
      ],
    },
    {
      offset: "0x08",
      name: "WRP",
      description: "Flash memory write protection status",
      type: "u32",
      reset: "0xFFFFFFFF",
      explaination: {
        "0xFFFFFFFF": "Unprotected",
        _: "Some 4K sections are protected",
      },
    },
  ],
  variants: [
    {
      name: "CH32X035R8T6",
      chip_id: 80,
      flash_size: 65536,
    },
    {
      name: "CH32X035C8T6",
      chip_id: 81,
      flash_size: 65536,
    },
    {
      name: "CH32X035F8U6",
      chip_id: 94,
      flash_size: 65536,
    },
    {
      name: "CH32X035G8U6",
      chip_id: 86,
      flash_size: 65536,
    },
    {
      name: "CH32X035G8R6",
      chip_id: 91,
      flash_size: 65536,
    },
    {
      name: "CH32X035F7P6",
      chip_id: 87,
      flash_size: 49152,
    },
  ],
};

class Protocol {
  IDENTIFY = 0xa1;
  ISP_END = 0xa2;
  ISP_KEY = 0xa3;
  ERASE = 0xa4;
  PROGRAM = 0xa5;
  VERIFY = 0xa6;
  READ_CONFIG = 0xa7;
  WRITE_CONFIG = 0xa8;
  DATA_ERASE = 0xa9;
  DATA_PROGRAM = 0xaa;
  DATA_READ = 0xab;
  WRITE_OTP = 0xc3;
  READ_OTP = 0xc4;
  SET_BAUD = 0xc5;
  async pwriteWith(buffer, value, offset, littleEndian) {
    if (typeof value === "number") {
      buffer.setUint32(offset, value, littleEndian);
    } else {
      for (let i = 0; i < value.length; i++) {
        buffer.setUint8(offset + i, value[i]);
      }
    }
    return buffer;
  }
  async ntoRaw(command) {
    switch (command.type) {
      case "Identify": {
        const { deviceId, deviceType } = command;
        const buf = new Uint8Array(0x12 + 3);
        buf[0] = this.IDENTIFY;
        buf[1] = 0x12;
        buf[2] = 0;
        buf[3] = deviceId;
        buf[4] = deviceType;
        buf.set(new TextEncoder().encode("MCU ISP & WCH.CN"), 5);
        return buf;
      }
      case "IspEnd": {
        const { reason } = command;
        return new Uint8Array([this.ISP_END, 0x01, 0x00, reason]);
      }
      case "IspKey": {
        const { key } = command;
        const buf = new Uint8Array(3 + key.length);
        buf[0] = this.ISP_KEY;
        buf[1] = key.length;
        buf[2] = 0x00;
        buf.set(key, 3);
        return buf;
      }
      case "Erase": {
        const { sectors } = command;
        const buf = new Uint8Array(7);
        buf[0] = this.ERASE;
        buf[1] = 0x04;
        buf[2] = 0x00;
        this.pwriteWith(new DataView(buf.buffer), sectors, 3, true);
        return buf;
      }
      case "Program": {
        const { address, padding, data } = command;
        // CMD, SIZE, ADDR, PADDING, DATA
        const buf = new Uint8Array(1 + 2 + 4 + 1 + data.length);
        // Create a DataView to manipulate the buffer
        const dataView = new DataView(buf.buffer);
        // Set the command in the first byte
        dataView.setUint8(0, this.PROGRAM);
        // Write the address in little-endian format starting at index 3
        dataView.setUint32(3, address, true);
        // Set the padding at index 7
        dataView.setUint8(7, padding);
        // Copy the data array into the buffer starting at index 8
        buf.set(data, 8);
        // Calculate the payload size and write it in little-endian format at index 1
        const payloadSize = buf.length - 3;
        dataView.setUint16(1, payloadSize, true);
        return new Uint8Array(dataView.buffer);
      }
      case "Verify": {
        const { address, padding, data } = command;
        const buf = new Uint8Array(1 + 2 + 4 + 1 + data.length);
        buf[0] = this.VERIFY;
        this.pwriteWith(new DataView(buf.buffer), address, 3, true);
        buf[7] = padding;
        buf.set(data, 8);
        const payloadSize = buf.length - 3;
        this.pwriteWith(new DataView(buf.buffer), payloadSize, 1, true);
        return buf;
      }
      case "ReadConfig": {
        const { bitMask } = command;
        return new Uint8Array([this.READ_CONFIG, 0x02, 0x00, bitMask, 0x00]);
      }
      case "WriteConfig": {
        const { bitMask, data } = command;
        const buf = new Uint8Array(1 + 2 + 2 + data.length);
        buf[0] = this.WRITE_CONFIG;
        this.pwriteWith(new DataView(buf.buffer), 1 + data.length, 1, true);
        buf[3] = bitMask;
        buf.set(data, 5);
        return buf;
      }
      case "DataRead": {
        const { address, len } = command;
        const buf = new Uint8Array(9);
        buf[0] = this.DATA_READ;
        buf[1] = 6; // fixed len
        this.pwriteWith(new DataView(buf.buffer), address, 3, true);
        this.pwriteWith(new DataView(buf.buffer), len, 7, true);
        return buf;
      }
      case "DataProgram": {
        const { address, padding, data } = command;
        const buf = new Uint8Array(1 + 2 + 4 + 1 + data.length);
        buf[0] = this.DATA_PROGRAM;
        this.pwriteWith(new DataView(buf.buffer), address, 3, true);
        buf[7] = padding;
        buf.set(data, 8);
        const payloadSize = buf.length - 3;
        this.pwriteWith(new DataView(buf.buffer), payloadSize, 1, true);
        return buf;
      }
      case "DataErase": {
        const { sectors } = command;
        const buf = new Uint8Array([
          this.DATA_ERASE,
          0x05,
          0x00,
          0x00,
          0x00,
          0x00,
          0x00,
          sectors,
        ]);
        return buf;
      }
      default:
        throw new Error("Unimplemented command");
    }
  }
}

class ResponseHandler {
  static responseToString(response) {
    switch (response.type) {
      case "Ok":
        return `OK[${Buffer.from(response.data).toString("hex")}]`;
      case "Err":
        return `ERROR(${response.code.toString(16)})[${Buffer.from(
          response.data
        ).toString("hex")}]`;
    }
  }
  static isOk(response) {
    return response.type === "Ok";
  }

  static payload(response) {
    return response.type === "Ok" ? response.data : response.data;
  }

  static fromRaw(raw) {
    const len = new DataView(raw.buffer).getUint16(2, true);
    const remain = raw.subarray(4);

    if (remain.length === len) {
      return { type: "Ok", data: remain };
    } else {
      return { type: "Err", code: raw[1], data: raw.subarray(2) };
    }
  }
}

class UsbTransport {
  //! Constants about protocol and devices.
  static ENDPOINT_OUT = 0x02;
  static ENDPOINT_IN = 0x02; //0x82;
  static USB_TIMEOUT_MS = 5000;
  static MAX_PACKET_SIZE = 64;
  static SECTOR_SIZE = 1024;
  static DEFAULT_TRANSPORT_TIMEOUT_MS = 1000;

  // private device: USBDevice;

  constructor(device) {
    this.device = device;
  }
  // static debugLog(message) {
  //   const consoleTextarea =
  //     document.querySelector<HTMLTextAreaElement>("#console")!;
  //   consoleTextarea.value += message + "\n";
  //   consoleTextarea.scrollTop = consoleTextarea.scrollHeight;
  // }
  // static clearLog() {
  //   const consoleTextarea =
  //     document.querySelector<HTMLTextAreaElement>("#console")!;
  //   consoleTextarea.value = "";
  // }
  static async scanDevices() {
    const filters = [
      { vendorId: 0x4348, productId: 0x55e0 },
      { vendorId: 0x1a86, productId: 0x55e0 },
    ];

    const devices = await navigator.usb.getDevices();
    const matchingDevices = devices.filter((device) =>
      filters.some(
        (filter) =>
          device.vendorId === filter.vendorId &&
          device.productId === filter.productId
      )
    );

    console.debug(`Found ${matchingDevices.length} WCH ISP USB devices`);
    return matchingDevices.length;
  }

  static async openNth(nth) {
    const devices = await navigator.usb.getDevices();
    const device = devices[nth];
    if (!device) {
      throw new Error(
        `No WCH ISP USB device found (4348:55e0 or 1a86:55e0 device not found at index #${nth})`
      );
    }

    console.debug(`Found USB Device ${device.productName}`);

    await device.open();

    // Select configuration and claim interface
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const config = device.configuration;
    let endpointOutFound = false;
    let endpointInFound = false;

    if (config) {
      console.log("config", config);
      for (const intf of config.interfaces) {
        console.log(intf);
        for (const endpoint of intf.alternate.endpoints) {
          if (endpoint.endpointNumber === this.ENDPOINT_OUT) {
            endpointOutFound = true;
          }
          if (endpoint.endpointNumber === this.ENDPOINT_IN) {
            endpointInFound = true;
          }
        }
      }
    }
    console.log("NNNNNNN", endpointOutFound, endpointInFound);
    if (!(endpointOutFound && endpointInFound)) {
      throw new Error("USB Endpoints not found");
    }

    await device.claimInterface(0);
    return new UsbTransport(device);
  }

  static async openAny() {
    return this.openNth(0);
  }

  async sendRaw(raw) {
    await this.device.transferOut(UsbTransport.ENDPOINT_OUT, raw);
  }

  async recvRaw() {
    const result = await this.device.transferIn(UsbTransport.ENDPOINT_IN, 64);
    if (result.data) {
      return new Uint8Array(result.data.buffer);
    }
    throw new Error("Failed to receive data");
  }
  async recv() {
    const result = await this.device.transferIn(UsbTransport.ENDPOINT_IN, 64);
    if (result.data) {
      return ResponseHandler.fromRaw(new Uint8Array(result.data.buffer));
    }
    throw new Error("Failed to receive data");
  }
}

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

  device_type = null;
  chip_id = null;
  chip_uid = new Uint8Array(8);
  code_flash_protected = null;
  btver = new Uint8Array(4);
  flash_size = null;

  protocol = new Protocol();
  constructor(device) {
    super(device);
  }
  supportCodeFlashProtect() {
    if (!this.device_type) return false;
    return [0x14, 0x15, 0x17, 0x18, 0x19, 0x20].includes(this.device_type);
  }
  minEraseSectorNumber() {
    if (this.device_type === 0x10) {
      return 4;
    } else {
      return 8;
    }
  }
  xorKey() {
    if (this.chip_id == null) throw new Error("Chip ID not found");
    // Calculate the checksum by adding up all the bytes in chipUid
    const checksum = this.chip_uid.reduce((acc, x) => acc + x, 0) & 0xff; // Ensure it's within u8 range

    // Create a key array filled with the checksum
    const key = new Uint8Array(8).fill(checksum);

    // Modify the last element of the key by adding the chipId and ensure it stays within u8 range
    key[7] = (key[7] + this.chip_id) & 0xff;

    return key;
  }
  async findDevice({ espLoaderTerminal }) {
    // CH_loader.clearLog();
    espLoaderTerminal.clean();

    //Identify Device
    const command1 = { type: "Identify", deviceId: 0, deviceType: 0 };
    const sendData1 = await this.protocol.ntoRaw(command1);
    this.sendRaw(sendData1);
    const res = await this.recv();
    if (res.type == "Err") throw new Error("Error in finding device");
    this.device_type = res.data[1];
    this.chip_id = res.data[0];
    //Display Device Series and Chip
    console.log(
      "BBBBBBBB",
      chipData.device_type,
      this.device_type.toString(16)
    );
    if (chipData.device_type == "0x" + this.device_type.toString(16)) {
      // CH_loader.debugLog("Device Series : " + chipData.name);

      espLoaderTerminal.writeLine("Device Series : " + chipData.name);
    }
    chipData.variants.forEach((variant) => {
      if (variant.chip_id == this.chip_id) {
        this.flash_size = variant.flash_size;
        // CH_loader.debugLog("Chip : " + variant.name);
        // CH_loader.debugLog(
        //   "Flash Size : " + variant.flash_size / 1024 + " KiB"
        // );
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
    if (res2.type == "Err") throw new Error("Error in finding config");
    //check if code flash is protected
    this.code_flash_protected =
      this.supportCodeFlashProtect() && res2.data[2] != 0xa5;
    // CH_loader.debugLog("Code Flash Protected : " + this.code_flash_protected);
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
    //get the chip UID
    this.chip_uid.set(res2.data.slice(18));
    // CH_loader.debugLog(
    //   "Chip UID : " +
    //     Array.from(this.chip_uid)
    //       .map((x) => x.toString(16).padStart(2, "0").toUpperCase())
    //       .join("-")
    // );
    //get the user config byte
    this.dumpInfo(res2);
  }
  async dumpInfo(res) {
    const raw = res.data.slice(2);
    chipData.config_registers.forEach((config) => {
      let n = new DataView(
        raw.buffer,
        raw.byteOffset + Number(config.offset), //reg_def.offset,
        4
      ).getUint32(0, true);
      // CH_loader.debugLog(config.name + " : 0x" + n.toString(16));
      if (config.fields) {
        config.fields.forEach((fieldDef) => {
          let bitWidth = fieldDef.bit_range[0] - fieldDef.bit_range[1] + 1;
          let b = (n >>> fieldDef.bit_range[1]) & ((1 << bitWidth) - 1);
          // CH_loader.debugLog(
          //   `[${fieldDef.bit_range[0]}, ${fieldDef.bit_range[1]}] ${
          //     fieldDef.name
          //   }  0x${b.toString(16)} (0b${b.toString(2)})`
          // );
          if ("explaination" in fieldDef && fieldDef.explaination) {
            for (const [key, value] of Object.entries(fieldDef.explaination)) {
              if (b == Number(key)) {
                // CH_loader.debugLog(` - ${value}`);
              }
            }
          }
        });
      }
    });
  }
  async eraseFlash(flash_size = this.flash_size) {
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
    const command = { type: "Erase", sectors: sectors };
    const sendData = await this.protocol.ntoRaw(command);
    this.sendRaw(sendData);
    console.log(sendData);
    const res = await this.recv();
    console.log(res);
    if (res.type == "Err") throw new Error("Error in erasing flash");
    else CH_loader.debugLog(`Erased ${sectors} code flash sectors`);
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
    this.sendRaw(sendData);
    const res = await this.recv();
    if (res.type == "Err") {
      throw new Error(
        `Program 0x${address.toString(16).padStart(8, "0")} failed`
      );
    }
    CH_loader.debugLog("Programmed 0x" + address.toString(16).padStart(8, "0"));
  }
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
    const raw = this.intelHexToUint8Array(firmware);
    const sectors = raw.length / this.SECTOR_SIZE + 1;
    if (!this.chip_id && !this.chip_uid) await this.findDevice();
    await this.eraseFlash(sectors);
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
    const command = { type: "IspEnd", reason: 1 };
    const sendData = await this.protocol.ntoRaw(command);
    this.sendRaw(sendData);
    const res = await this.recv();
    if (res.type == "Err") throw new Error("Error in reset");
    CH_loader.debugLog("Device Reset");
  }
}
