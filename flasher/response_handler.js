export class ResponseHandler {
    static responseToString(response) {
        switch (response.type) {
            case "Ok":
                return `OK[${Buffer.from(response.data).toString("hex")}]`;
            case "Err":
                return `ERROR(${response.code.toString(16)})[${Buffer.from(response.data).toString("hex")}]`;
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
        }
        else {
            return { type: "Err", code: raw[1], data: raw.subarray(2) };
        }
    }
}
