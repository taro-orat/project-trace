float t = 0;

int traceDensity = 10;
float distortion = 60;
float traceSize = 15;
float traceAlpha = 25;

float eraseX = 300;
float eraseY = 300;

void setup() {
  size(600, 600);
  background(255);
}

void draw() {

  // 1. 白色擦除层慢慢追赶鼠标
  eraseX = lerp(eraseX, mouseX, 0.03);
  eraseY = lerp(eraseY, mouseY, 0.03);

  noStroke();
  fill(255, 35);

  circle(
    eraseX,
    eraseY,
    160
  );


  // 2. 鼠标移动时产生新的黑色痕迹
  if (mouseX != pmouseX || mouseY != pmouseY) {

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
        mouseX + noiseX + randomX,
        mouseY + noiseY + randomY,
        traceSize
      );
    }
  }

  t = t + 0.01;
}
