float t = 0;

int traceDensity = 10;
float distortion = 150;
float traceSize = 15;
float traceAlpha = 10;

void setup() {
  size(600, 600);
  background(255);
}

void draw() {
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
      mouseX + noiseX + randomX,
      mouseY + noiseY + randomY,
      traceSize
    );
  }

  t = t + 0.01;
}
