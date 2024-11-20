import { Response } from "./types";

export class ResponseHandler {
  static responseToString(response: Response): string {
    switch (response.type) {
      case "Ok":
        return `OK[${Buffer.from(response.data).toString("hex")}]`;
      case "Err":
        return `ERROR(${response.code.toString(16)})[${Buffer.from(
          response.data
        ).toString("hex")}]`;
    }
  }
  static isOk(response: Response): boolean {
    return response.type === "Ok";
  }

  static payload(response: Response): Uint8Array {
    return response.type === "Ok" ? response.data : response.data;
  }

  static fromRaw(raw: Uint8Array): Response {
    const len = new DataView(raw.buffer).getUint16(2, true);
    const remain = raw.subarray(4);

    if (remain.length === len) {
      return { type: "Ok", data: remain };
    } else {
      return { type: "Err", code: raw[1], data: raw.subarray(2) };
    }
  }
}
