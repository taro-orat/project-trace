let img;


function preload() {

  img =
    loadImage(
      "assets/test.jpg"
    );
}


function setup() {

  createCanvas(
    800,
    600
  );
}


function draw() {

  background(255);


  tint(
    255,
    230
  );


  image(
    img,
    100,
    100,
    400,
    300
  );
}