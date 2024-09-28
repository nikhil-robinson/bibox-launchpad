export type Chip = {
  name: string; // Chip's name, without variants suffix
  chipId: number;
  altChipIds: number[];
  mcuType: number;
  deviceType: number;
  flashSize: number;
  eepromSize: number;
  eepromStartAddr: number;
  supportNet?: boolean;
  supportUsb?: boolean;
  supportSerial?: boolean;
  //   configRegisters: ConfigRegister[];
};

export type Command =
  | { type: "Identify"; deviceId: number; deviceType: number }
  | { type: "IspEnd"; reason: number }
  | { type: "IspKey"; key: Uint8Array }
  | { type: "Erase"; sectors: number }
  | { type: "Program"; address: number; padding: number; data: Uint8Array }
  | { type: "Verify"; address: number; padding: number; data: Uint8Array }
  | { type: "ReadConfig"; bitMask: number }
  | { type: "WriteConfig"; bitMask: number; data: Uint8Array }
  | { type: "DataRead"; address: number; len: number }
  | { type: "DataProgram"; address: number; padding: number; data: Uint8Array }
  | { type: "DataErase"; sectors: number };

export type Response =
  | { type: "Ok"; data: Uint8Array }
  | { type: "Err"; code: number; data: Uint8Array };

export interface ConfigField {
  bit_range: number[]; // Ensure that bit_range is always a tuple of exactly two numbers
  name: string;
  description?: string;
  explaination?: Object;
}

export interface ConfigRegister {
  offset: string;
  name: string;
  description?: string;
  reset: string;
  type?: string;
  fields?: ConfigField[];
}

export interface Variant {
  name: string;
  chip_id: number;
  flash_size: number;
  eeprom_size?: number;
  alt_chip_ids?: string[] | number[];
}

export interface ChipData {
  name: string;
  mcu_type: string;
  device_type: string;
  support_usb: boolean;
  support_serial: boolean;
  support_net: boolean;
  description: string;
  config_registers?: ConfigRegister[];
  variants: Variant[];
}

export interface EspTerminal {
  clean: () => void;
  writeLine: (data: string) => void;
  write: (data: string) => void;
}
