// Official DevKitC-1 headers, numbered from antenna to USB on each side.
// https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html#header-block
export const ESP32_S3_J1 = ['3V3', '3V3', 'RST', '4', '5', '6', '7', '15', '16', '17', '18', '8', '3', '46', '9', '10', '11', '12', '13', '14', '5V', 'GND'] as const
export const ESP32_S3_J3 = ['GND', 'TX', 'RX', '1', '2', '42', '41', '40', '39', '38', '37', '36', '35', '0', '45', '48', '47', '21', '20', '19', 'GND', 'GND'] as const
// USB points right: J1 below left-to-right, J3 above right-to-left.
export const ESP32_S3_PINS = [
  ...ESP32_S3_J1.map((name, index) => ({ header: 'J1', number: index + 1, name })),
  ...ESP32_S3_J3.map((name, index) => ({ header: 'J3', number: index + 1, name })).reverse(),
]
