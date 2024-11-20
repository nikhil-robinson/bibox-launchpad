# This is port of the offical esp-lauchpad to support the firmwares of YUDU robotics.

This is a modified version of the offical esp-lauchpad to add support for other microcontrollers. This is done for YuDU robotics to hast there firmware easily.


ESP Launchpad is a web based tool, available for flashing firmware application to the ESP32 device connected via USB serial port.

There are two modes available for using this tool:

Quick Start : 4 Easy Steps - Plug, Connect, Choose Built-In Firmware Image, Flash!
DIY : For Advanced Users, use your own pre-built Firmware Image from local storage and Flash!
Quick Start:

ESP currently provides a few built in, ready to use examples that can be flashed on the ESP32 devices. You can choose one of the built in firmware application for either RainMaker or Matter, and as per the chipset type. Just plug in your ESP32 device to the serial USB port. Use connect option in the menu to connect to your ESP32 device. Choose the firmware from the built-in firmware example set. Click Flash!

The firmware will be flashed on to your connected device. You can watch the progress of the firmware flashing in the console window.

This easy, 4 step process will flash the firmware on to the connected device and bring it into play as you want it to be.

Try Now

DIY:

You can build your own firmware binaries using the ESP IDF tools. These firmware images can then be flashed from your local machine to the connected device. Just connect your ESP32 device to the serial USB port. Using the web based tool, connect to your device. You can then select the firmware application from the local storage of the machine. Choose the memory address where to flash the firmware. Firmware can be a single file or a set of multiple files to be flashed at particular memory addresses.

Click Flash!

The firmware will be flashed on to your connected device. You can watch the progress of the firmware flashing in the console window.




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


# Credits

1. [Tushar kanti](https://github.com/tusharkanti647) for the addition of WCH series 
2. [Goutham S krishna](https://github.com/gouthamsk98r) for the [wchisp webusn support](https://github.com/gouthamsk98/wchisp-webusb)