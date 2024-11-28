export class Protocol {
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
        }
        else {
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
