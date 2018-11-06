
// read_mlx90614.ino
//#define RX_PIN_NUMBER  24
//#define TX_PIN_NUMBER  23

#include <i2cmaster.h>

#include "i2cmaster.h"

//byte MLX_one   = 0x31;
byte MLX_one   = 0x2A;
//byte MLX_one   = 0x00;
byte MLX_two   = 0x2B;
byte MLX_three = 0x2C;
byte MLX_four  = 0x2D;
byte MLX_five  = 0x2E;
//byte MLX_n = 0x1D;

void setup() {
  Serial.begin(9600);
  delay(500);
  Serial.println("Setup...");
  // Initialise some stuff
  i2c_init();
//  PORTC = (1 << PORTC4) | (1 << PORTC5);
}

void loop() {
    ReadTemp(MLX_one);
    delay(500);
 /*   ReadTemp(MLX_two);
    delay(500);
    ReadTemp(MLX_three);
    delay(500);
    ReadTemp(MLX_four);
    delay(500);
    ReadTemp(MLX_five);
    delay(500);
    //ReadTemp(MLX_n);
    //delay(1000); */
}

