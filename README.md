# THis is port of the offical esp-lauchpad to support the firmwares of YUDU robotics.

# WCH Board Update Process

## Steps to Update the WCH Board

1. **Select the WCH Board**: In the "Select Application" dropdown, choose the WCH board.
2. **Connect Board**: Click on "Connect Board."
3. **Flash the Board**: Click the "Flash" button to flash the board.

## Adding a New Board

1. **New Board for Update**: If you want to add a new board for updates from the Bibox Launchpad:
   - For **ESP** chipsets, the board uses web serial for read and write operations.
   - For **WCH** chipsets, the board uses web USB for read and write operations.
2. **Editing `config.toml`**:
   - Go to the `config` folder and edit the `config.toml` file.
   - Add the new board like this:
     ```toml
     [ATR_H2]
     chipsets = ["ESP32-H2"]
     image.esp32-h2 = "atr_h2/atr_h2.bin"
     chipType = "ESP"
     ```
   - Here, `ATR_H2` is the new board name, and `chipType` is either **ESP** or **WCH**.
3. **Update `usbPortFilters`**:
   - Add the filter `productId` and `vendorId` in the `utils.js` file, found in the `js` folder.
   - For **WCH** boards, update the `usb_Port_Filters` array in the `utils.js` file.For **ESP** boards, update the `usbPortFilters` array in the `utils.js` file.

## Changing the WCH Board Flasher Code

If you need to modify the WCH board flasher code, follow these instructions:

1. **Editing TypeScript Files**:
   - Do not directly modify any `.js` or `.json` files in the `flasher` folder.
   - Instead, go to the `flasherTypeScript` folder and edit the corresponding TypeScript (`.ts`) files.
2. **Compile TypeScript**:

   - After making changes to the TypeScript files, run the following command to generate the updated `.js` and `.json` files:
     ```bash
     tsc
     ```

3. **Update the Import Format**:

   - In the `flasher` folder, update the import statements in the `.js` files.
   - Example (in `ch_loader.js`):
     ```javascript
     import * as transport_handler from "./transport_handler.js";
     import * as protocol_handler from "./protocol_handler.js";
     import chipData_0x21 from './target/0x21-CH32V00x.json' with { type: "json" };
     import chipData_0x22 from './target/0x22-CH59x.json' with { type: "json" };
     import chipData_0x23 from './target/0x23-CH32X03x.json' with { type: "json" };
     import chipData_0x24 from './target/0x24-CH643.json' with { type: "json" };
     ```

4. **Modify `transport_handler.js`**:

   - Change the import statement:
     ```javascript
     import * as response_handler from "./response_handler.js";
     ```

5. **Save and Push Changes**:
   - After completing the changes, save your work and push it to your repository.
