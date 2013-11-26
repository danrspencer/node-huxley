'use strict';

var fs = require('fs');
var exec = require('child_process').exec;

function writeToFile(path, rawImageBuffer, done) {

  var imageBuffer = new Buffer(rawImageBuffer, 'base64');
  fs.writeFile(path, imageBuffer, done);

}

function writeToFileNoCallback(path, rawImageBuffer) {

    var imageBuffer = new Buffer(rawImageBuffer, 'base64');
    fs.writeFileSync(path, imageBuffer);

}

function compareAndSaveDiffOnMismatch(image1Buffer, image2Path, taskPath, done) {

    var capturePath = taskPath + '/capture.png';
    var diffPath = taskPath + '/diff.png';
    var captureImage = image1Buffer;
    writeToFileNoCallback(capturePath, captureImage);
    cropImage(capturePath, taskPath, function(){
        _checkIfDifferent(capturePath, image2Path, function(err, areSame) {
            if (!areSame) {
                console.log('Compared images were different');
                _saveDiffImage(capturePath, image2Path, diffPath, function(err) {
                done(err, areSame);
                })
            } else {
                console.log('Compared images were the same');
                try {
                fs.unlinkSync(diffPath);
                } catch(error) {

                }
                done(err, areSame);
            }
        });
    });
}

function _checkIfDifferent(image1Path, image2Path, done) {

    var escapedImage1Path = image1Path.replace(/ /g, '\\ ');
    var escapedImage2Path = image2Path.replace(/ /g, '\\ ');

  exec(
    'gm compare -metric mse ' + escapedImage1Path + ' ' + escapedImage2Path + '',
    function (err, stdout) {
      if (err) return done(err);

      // the output is an ascii table, with the last row like this:
      // Total: 0.0000607584        0.0
      //           ^ what we want
      var match = /Total: (\d+\.?\d*)/m.exec(stdout);

      if (!match) return done('Unable to compare images: %s', stdout);

      var equality = parseFloat(match[1]);
      done(err, equality < 0.000000005); // Give the image a small margin of error
    }
  );
}

function cropImage(imagePath, taskPath, done) {

    var escapedImagePath = imagePath.replace(/ /g, '\\ ');

    var properties = taskPath + '/properties.json';

    fs.readFile(properties, 'utf8', function (err, data) {
        if (err) {
            console.log('Error: Could not read properties.json file');
            done();
            return;
        }

        data = JSON.parse(data);

        var width = data['width'];
        var height = data['height'];
        var xoffset = data['xoffset'];
        var yoffset = data['yoffset'];

        exec(
            'gm convert -crop ' + width + 'x' + height + '+' + xoffset + '+' + yoffset + ' ' + escapedImagePath + ' ' + escapedImagePath,
            function(err, stdout) {
                if (err) return done(err);
                done();
            }
        );

    });

}

function _saveDiffImage(image1Path, image2Path, diffPath, done) {
  exec(
    'gm compare -file "' + diffPath + '" "' + image1Path +
    '" "' + image2Path + '"',
    done
  );
}

function removeDanglingImages(taskPath, index, done) {
  // a new recording might take less screenshots than the previous
  var imagePath = taskPath + '/' + index + '.png';
  if (!fs.existsSync(imagePath)) return done();

  fs.unlink(imagePath, function(err) {
    if (err) return done(err);
    removeDanglingImages(taskPath, index + 1, done);
  });
}

module.exports = {
  writeToFile: writeToFile,
  compareAndSaveDiffOnMismatch: compareAndSaveDiffOnMismatch,
  removeDanglingImages: removeDanglingImages,
  cropImage: cropImage
};
