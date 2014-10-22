var svd = require('node-svd').svd;
var agmath = require('agmath');
var fs = require('fs');
var PNG = require('pngjs').PNG;
var Png = require('png').Png;
var Buffer = require('buffer').Buffer;

var Matrix = agmath.Matrix.Matrix;

function imageFileToMatrix(filename, callback) {
    fs.createReadStream(filename)
        .pipe(new PNG())
        .on('parsed', function () {

            var imageMatrix = [];

            for (var k = 0; k < this.width; k++) {
                imageMatrix[k] = [];
            }

            for (var y = 0; y < this.height; y++) {
                for (var x = 0; x < this.width; x++) {

                    // compute idx value
                    var idx = (this.width * y + x) << 2;

                    // use Rec. 709 Luma formula for grayscale conversion
                    // see http://en.wikipedia.org/wiki/Rec._709#Luma_coefficients
                    var value = this.data[idx] * 0.2126
                        + this.data[idx+1] * 0.7152
                        + this.data[idx+2] * 0.0722;

                    // put the grayscale value into the matrix
                    imageMatrix[x][y] = Math.round(value);

                    // now write back the grayscale values for funsies
                    this.data[idx] = value;
                    this.data[idx+1] = value;
                    this.data[idx+2] = value;

                }
            }

            this.pack().pipe(fs.createWriteStream('out.png'));

            callback(imageMatrix, {
                width: this.width,
                height: this.height
            });

        });
};

imageFileToMatrix('image.png', function (matrix, options) {

    var res = svd(matrix, 0);

    var n = options.width;
    var m = options.height;

    var original = new Matrix(m, n);
    original.setMatrix(matrix);

    var U = new Matrix(m, m);
    var S = new Matrix(m, n);
    var V = new Matrix(n, n);

    U.setMatrix(res.U);
    V.setMatrix(res.V);

    // construct the Sigma matrix
    var sigma = [];

    for (var x = 0; x < m; x++) {
        var row = [];
        for (y = 0; y < n; y++) {
            if (y === x) {
                row[y] = res.S[x];
            } else {
                row[y] = 0;
            }
        }
        sigma.push(row);
    }

    S.setMatrix(sigma);

    // now perform the multiplication
    var intermediate = U.multiply(S);
    var result = intermediate.multiply(V);

    var rgb = new Buffer(m * n * 3);

    for (var x = 0; x < m; x++) {
        for (var y = 0; y < n; y++) {
            var value = Math.round(result.getValue(y, x).toNumber());
            rgb[x*m*3 + y*3 + 0] = value;
            rgb[x*m*3 + y*3 + 1] = value;
            rgb[x*m*3 + y*3 + 2] = value;
        }
    }

    var img = new Png(rgb, n, m, 'rgb');

    fs.writeFileSync('./compressed.png', img.encodeSync().toString('binary'), 'binary');

});