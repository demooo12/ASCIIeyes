let video;
let bodyPose;
let poses = [];

// Tracking and spatial calibration variables
let offsetX = 0;
let offsetY = 0;
let scaleMult = 1.0;
let faceThreshold = 0.5;

// State variables
let isFacing = false;
let showUI = true;

// Mapping variables
let mappingMode = true;
let boxes = []; //Stores all selection boxes
let isDrawing = false; //区Whether a selection box is currently being dragged
let startX, startY, currentX, currentY;

function preload() {
  bodyPose = ml5.bodyPose();
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.style("display", "block");

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  bodyPose.detectStart(video, (results) => {
    poses = results;
  });
  textFont("monospace");
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(0);

  let targetX = width / 2;
  let targetY = height / 2;

  // Get tracking coordinates
  if (poses.length > 0) {
    let pose = poses[0];
    let nose = pose.keypoints[0];

    if (nose.confidence > faceThreshold) {
      isFacing = true;
      targetX = map(nose.x, 0, 640, 0, width) * scaleMult + offsetX;
      targetY = map(nose.y, 0, 480, 0, height) * scaleMult + offsetY;
    } else {
      isFacing = false;
    }
  } else {
    isFacing = false;
  }

  //ASCII eyes
  if (isFacing) {
    for (let box of boxes) {
      drawDynamicAsciiEye(box, targetX, targetY);
    }
  }

  //Preview box when dragging the mouse
  if (mappingMode && isDrawing) {
    push();
    stroke(0, 255, 0, 84);
    strokeWeight(2);
    noFill();
    drawingContext.setLineDash([5, 5]); //Dashed line box effect
    rectMode(CORNERS);
    rect(startX, startY, currentX, currentY);
    pop();
  }

  //UI
  if (showUI) drawCalibrationPanel();
}

//ASCII eye generator main part(adapts to box size)
function drawDynamicAsciiEye(box, tx, ty) {
  push();
  let cx = box.x + box.w / 2;
  let cy = box.y + box.h / 2;
  translate(cx, cy);
  textAlign(CENTER, CENTER);
  fill(0, 255, 0);

  let charSpacingX = 12;
  let charSpacingY = 18;

  //Calculate the number of rows and columns based on the selection size
  let cols = max(2, floor(box.w / 2 / charSpacingX));
  let rows = max(2, floor(box.h / 2 / charSpacingY));

  //Constrain the pupil's movement within the box
  let pupilRangeX = max(1, cols / 2.5);
  let pupilRangeY = max(1, rows / 2.5);
  let pupilOffsetX = constrain(
    map(tx - cx, -width / 2, width / 2, -pupilRangeX, pupilRangeX),
    -pupilRangeX,
    pupilRangeX
  );
  let pupilOffsetY = constrain(
    map(ty - cy, -height / 2, height / 2, -pupilRangeY, pupilRangeY),
    -pupilRangeY,
    pupilRangeY
  );

  textSize(16);

  for (let i = -rows; i <= rows; i++) {
    let rowStr = "";
    for (let j = -cols; j <= cols; j++) {
      //Using ellipse equation to determine if within the eye socket
      let d = (j * j) / (cols * cols) + (i * i) / (rows * rows);

      if (d < 1.0) {
        //Determine if within the pupil range
        let pupilRadiusX = max(1, cols / 5);
        let pupilRadiusY = max(1, rows / 5);
        let pd =
          pow(j - pupilOffsetX, 2) / (pupilRadiusX * pupilRadiusX) +
          pow(i - pupilOffsetY, 2) / (pupilRadiusY * pupilRadiusY);

        if (pd < 1.0) {
          rowStr += "@"; //central pupil >>>'@'
        } else if (pd < 2.5) {
          rowStr += "0"; //pupil outsider part >>>'0'
        } else {
          rowStr += "."; //the white space of the eyes >>>'.'
        }
      } else if (d < 1.15) {
        rowStr += "#"; //eye socket outline >>>'#'
      } else {
        rowStr += " "; //blank space >>>' '
      }
    }
    text(rowStr, 0, i * charSpacingY);
  }
  pop();
}

//the logic when dragging the mouse to creaate a new box

function mousePressed() {
  if (!mappingMode) return;
  isDrawing = true;
  startX = mouseX;
  startY = mouseY;
  currentX = mouseX;
  currentY = mouseY;
}

function mouseDragged() {
  if (!mappingMode || !isDrawing) return;
  currentX = mouseX;
  currentY = mouseY;
}

function mouseReleased() {
  if (!mappingMode || !isDrawing) return;
  isDrawing = false;

  //calculate left-top corner's pos & width/height
  let w = abs(currentX - startX);
  let h = abs(currentY - startY);
  let x = min(startX, currentX);
  let y = min(startY, currentY);

  //if it's toooo small, the system will ignore it
  if (w > 30 && h > 30) {
    boxes.push({ x: x, y: y, w: w, h: h });
  }
}

//UI hint & keyboard pressing

function drawCalibrationPanel() {
  push();
  fill(0, 255, 0, 200);
  textSize(14);
  let modeText = mappingMode ? "MAPPING MODE (ON)" : "PLAY MODE (HIDDEN)";
  let txt = `> SYSTEM STATUS: ${modeText}\n> EYES ACTIVE: ${
    boxes.length
  }\n> SENSITIVITY: ${faceThreshold.toFixed(
    2
  )}\n-----------------------\n[Mouse] Draw Mapping Eyes\n[Z] Undo Last Eyes\n[X] Clear All Eyes\n[M] Toggle Mapping/Play\n[F] Fullscreen | [C] Hide UI`;
  text(txt, 20, 30);
  pop();
}

function keyPressed() {
  //interactive control
  if (key === "m" || key === "M") mappingMode = !mappingMode;
  if (key === "z" || key === "Z") boxes.pop(); //delete the last box
  if (key === "x" || key === "X") boxes = []; //delete all boxes

  //basic scene control:to adjust the target position sothat the eyes can always look at audience.
  if (key === "[") faceThreshold = constrain(faceThreshold - 0.05, 0.05, 0.95);
  if (key === "]") faceThreshold = constrain(faceThreshold + 0.05, 0.05, 0.95);
  if (keyCode === UP_ARROW) offsetY -= 10;
  if (keyCode === DOWN_ARROW) offsetY += 10;
  if (keyCode === LEFT_ARROW) offsetX -= 10;
  if (keyCode === RIGHT_ARROW) offsetX += 10;
  if (key === "w" || key === "W") scaleMult += 0.02;
  if (key === "s" || key === "S") scaleMult -= 0.02;
  if (key === "c" || key === "C") showUI = !showUI;
  if (key === "f" || key === "F") fullscreen(!fullscreen());
}
