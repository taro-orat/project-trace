float t = 0;

int traceDensity = 10;
float distortion = 60;
float traceSize = 15;
float traceAlpha = 40;

int decayStep = 1;

void setup() {
  size(600, 600);
  background(255);
  frameRate(30);
}

void draw() {

  decayCanvas();

  if (mouseX != pmouseX || mouseY != pmouseY) {
    drawTrace(mouseX, mouseY);
  }

  t = t + 0.01;
}


// 让整个画布上的旧痕迹逐渐回到白色
void decayCanvas() {

  loadPixels();

  for (int i = 0; i < pixels.length; i++) {

    color currentColor = pixels[i];

    float r = min(255, red(currentColor) + decayStep);
    float g = min(255, green(currentColor) + decayStep);
    float b = min(255, blue(currentColor) + decayStep);

    pixels[i] = color(r, g, b);
  }

  updatePixels();
}


// 生成新的痕迹
void drawTrace(float x, float y) {

  noStroke();
  fill(0, traceAlpha);

  for (int i = 0; i < traceDensity; i++) {

    float noiseX = map(
      noise(t + i * 0.1),
      0, 1,
      -distortion, distortion
    );

    float noiseY = map(
      noise(t + 1000 + i * 0.1),
      0, 1,
      -distortion, distortion
    );

    float randomX = random(-10, 10);
    float randomY = random(-10, 10);

    circle(
      x + noiseX + randomX,
      y + noiseY + randomY,
      traceSize
    );
  }
}
