//region GLOBAL CONSTANTS AND VARIABLES
/* assignment specific globals */
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json"; // ellipsoids file loc
var defaultEye = vec3.fromValues(0.5,0.5,-0.5); // default eye position in world space
var defaultCenter = vec3.fromValues(0.5,0.5,0.5); // default view direction in world space
var defaultUp = vec3.fromValues(0,1,0); // default view up vector
var lightAmbient = vec3.fromValues(1,1,1); // default light ambient emission
var lightDiffuse = vec3.fromValues(1,1,1); // default light diffuse emission
var lightSpecular = vec3.fromValues(1,1,1); // default light specular emission
var lightPosition = vec3.fromValues(2,4,-0.5); // default light position
var rotateTheta = Math.PI/50; // how much to rotate models by with each key press

// My globals
const INPUT_BASE_URL = "https://ncsucgclass.github.io/prog3/"; // base url
// const INPUT_BACKGROUND_URL = "https://ncsucgclass.github.io/prog3/stars.jpg"; // background file loc
// const INPUT_BACKGROUND_URL = "https://ncsucgclass.github.io/prog3/stars.jpg"; // background file loc
const INPUT_BACKGROUND_URL = "https://ncsucgclass.github.io/prog3/sky.jpg"; // background file loc
// const INPUT_BACKGROUND_URL = "https://ncsucgclass.github.io/prog3/stars.jpg"; // background file loc
const INPUT_MULTITEXTURE_URL = "https://ncsucgclass.github.io/prog3/retro.jpg"; // multitexture url
const DELTA_TRANS = 0.0125; const DELTA_ROT = -rotateTheta;
const LATITUDE_COUNT = 20; const LONGITUDE_COUNT = 40;
var LookAt = vec3.sub(vec3.create(), defaultCenter, defaultEye); // default eye look at direction in world space
var ViewUp = vec3.clone(defaultUp); // default eye view up direction in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var shaderProgram;
var vertexPositionAttrib; // where to put position for vertex shader
var vertexNormalAttrib; // where to put normal for vertex shader
var textureUVAttrib; // where to put texture uvs for vertex shader

var option = {useLight: 0, lightModel: 0, transparent: 0, depthSort: 0};

var models = {selectId: -1, array: []};
var triangleSets = {};
var ellipsoids = {};
var bsp;
var lightArray = [];
// var lightsURL;
var multitexture;

var camera = {};
var uniforms = {};

var currentlyPressedKeys = [];
//endregion

// ASSIGNMENT HELPER FUNCTIONS

//region Set up environment
// Load data from document
function loadDocumentInputs() {
    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    option.useLight = document.getElementById("UseLight").checked? 1 : 0;
    option.transparent = document.getElementById("Transparent").checked? 1 : 0;
    option.textureTransparent = document.getElementById("TextureTransparent").checked? 1 : 0;
    option.depthSort = document.getElementById("depthSort").checked? 1 : 0;
    option.multitexture = document.getElementById("Multitexture").checked? 1 : 0;
    option.BSPTree = document.getElementById("BSPTree").checked? 1 : 0;
    // lightsURL = document.getElementById("LightsURL").value;
    canvas.width = parseInt(document.getElementById("Width").value);
    canvas.height = parseInt(document.getElementById("Height").value);
    imageCanvas.width = canvas.width;
    imageCanvas.height = canvas.height;
    camera.left = parseFloat(document.getElementById("WLeft").value);
    camera.right = parseFloat(document.getElementById("WRight").value);
    camera.top = parseFloat(document.getElementById("WTop").value);
    camera.bottom = parseFloat(document.getElementById("WBottom").value);
    camera.near = parseFloat(document.getElementById("WNear").value);
    camera.far = parseFloat(document.getElementById("WFar").value);
}

// Set up key event
function setupKeyEvent() {
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
}

// Set up the webGL environment
function setupWebGL() {

    // Get the image canvas, render an image in it
    var imageCanvas = document.getElementById("myImageCanvas"); // create a 2d canvas
    var cw = imageCanvas.width, ch = imageCanvas.height;
    imageContext = imageCanvas.getContext("2d");
    var bkgdImage = new Image();
    bkgdImage.crossOrigin = "Anonymous";
    bkgdImage.src = INPUT_BACKGROUND_URL;
    bkgdImage.onload = function(){
        var iw = bkgdImage.width, ih = bkgdImage.height;
        imageContext.drawImage(bkgdImage,0,0,iw,ih,0,0,cw,ch);
    } // end onload callback

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    gl.viewportWidth = canvas.width; // store width
    gl.viewportHeight = canvas.height; // store height
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        // gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// Set up the webGL shaders
function setupShaders() {

    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;
        struct light_struct {
            vec3 xyz;
            vec3 ambient;
            vec3 diffuse;
            vec3 specular;
        };  
        struct material_struct {
            vec3 ambient;
            vec3 diffuse;
            vec3 specular;
            float n;
            float alpha;
        };
        struct option_struct {
            int useLight;
            int lightModel;
            int transparent;
            int textureTransparent;
            int multitexture;
        };
        
        uniform light_struct uLights[N_LIGHT];
        uniform material_struct uMaterial;
        uniform option_struct uOption;
        uniform sampler2D uTexture;
        uniform sampler2D uMultiTexture;
        
        varying vec3 vTransformedNormal;
        varying vec4 vPosition;
        varying vec3 vCameraDirection;
        varying vec2 vTextureUV;

        void main(void) {
            vec3 rgb = vec3(0, 0, 0);
            vec4 textureColor = texture2D(uTexture, vTextureUV);
            vec4 multitextureColor = texture2D(uMultiTexture, vTextureUV);
            float alpha = 1.0;
            
            if(uOption.useLight == 0) {
                rgb = textureColor.rgb;
            } else {
                vec3 ambientColor;
                vec3 diffuseColor;
                vec3 specularColor;
                
                // Different light/texture blending models
                if(0 == uOption.lightModel) {          // Replace
                    ambientColor = textureColor.rgb;
                    diffuseColor = textureColor.rgb;
                    specularColor = uMaterial.specular;
                } else if(1 == uOption.lightModel) {   // Modulate
                    ambientColor = textureColor.rgb * uMaterial.ambient;
                    diffuseColor = textureColor.rgb * uMaterial.diffuse;
                    specularColor = uMaterial.specular;
                }
                
                for(int i = 0; i < N_LIGHT; i++) {
                    vec3 L = normalize(uLights[i].xyz - vPosition.xyz);
                    vec3 V = normalize(vCameraDirection);
                    vec3 N = normalize(vTransformedNormal);
                    float dVN = dot(V, N);
                    float dLN = dot(L, N);
                    vec3 rgbAdd = ambientColor * uLights[i].ambient;    // Ambient shading
                    if(dLN > 0.0 && dVN > 0.0) {
                        rgbAdd += dLN * (diffuseColor * uLights[i].diffuse);    // Diffuse shading
                        vec3 H = normalize(V + L);
                        float weight = pow(dot(N, H), uMaterial.n);
                        if(weight > 0.0) rgbAdd += weight * (specularColor * uLights[i].specular);  // specular shading
                    }
                    if(1 == uOption.multitexture) rgbAdd *= multitextureColor.rgb;  // Multitexture
                    rgb += rgbAdd;
                }
            }
                
            if(1 == uOption.textureTransparent) alpha *= textureColor.a;
            if(1 == uOption.transparent) alpha *= uMaterial.alpha;
            gl_FragColor = vec4(rgb, alpha); // without texture
            // gl_FragColor = textureColor; // with texture
        }
    `;
    fShaderCode = "#define N_LIGHT " + lightArray.length + "\n" + fShaderCode;

    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        attribute vec2 textureUV;

        uniform mat4 uMMatrix;      // Model transformation
        uniform mat4 uVMatrix;      // Viewing transformation
        uniform mat4 uPMatrix;      // Projection transformation
        uniform mat3 uNMatrix;      // Normal vector transformation
        uniform vec3 uCameraPos;    // Camera position
        uniform bool uDoubleSide;
        
        varying vec3 vTransformedNormal;
        varying vec4 vPosition;
        varying vec3 vCameraDirection;
        varying vec2 vTextureUV;

        void main(void) {
            vPosition = uMMatrix * vec4(vertexPosition, 1.0);
            vTextureUV = textureUV;
            vCameraDirection = uCameraPos - vPosition.xyz;
            gl_Position = uPMatrix * uVMatrix * vPosition;
            vTransformedNormal = uNMatrix * vertexNormal;
            if(uDoubleSide && dot(vCameraDirection, vTransformedNormal) < 0.0)
                vTransformedNormal = -vTransformedNormal;
        }
    `;

    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution

        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);
            gl.deleteShader(vShader);
        } else { // no compile errors
            shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition");
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib); // input to shader from array

                textureUVAttrib = gl.getAttribLocation(shaderProgram, "textureUV");
                gl.enableVertexAttribArray(textureUVAttrib); // input to shader from array

                // Get uniform matrices
                uniforms.cameraPosUniform = gl.getUniformLocation(shaderProgram, "uCameraPos");
                uniforms.mMatrixUniform = gl.getUniformLocation(shaderProgram, "uMMatrix");
                uniforms.vMatrixUniform = gl.getUniformLocation(shaderProgram, "uVMatrix");
                uniforms.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
                uniforms.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
                uniforms.doubleSideUniform = gl.getUniformLocation(shaderProgram, "uDoubleSide");
                uniforms.textureUniform = gl.getUniformLocation(shaderProgram, "uTexture");
                uniforms.multitextureUniform = gl.getUniformLocation(shaderProgram, "uMultiTexture");
                uniforms.optionUniform = getOptionUniformLocation(shaderProgram, "uOption");
                uniforms.materialUniform = getMaterialUniformLocation(shaderProgram, "uMaterial");
                uniforms.lightUniformArray = [];
                for (let i = 0; i < lightArray.length; i++) {
                    uniforms.lightUniformArray[i] = getLightUniformLocation(shaderProgram, "uLights[" + i + "]");
                }
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try

    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders
//endregion

//region Handle events
function handleKeyDown(event) {
    currentlyPressedKeys[event.keyCode] = true;

    // Part 4: interactively change view
    // Part 5: Interactively select a model
    switch(event.key) {
        case "a":    // a — translate view left along view X
            translateCamera(vec3.fromValues(-DELTA_TRANS, 0, 0));
            renderTriangles();
            return;
        case "d":    // d — translate view right along view X
            translateCamera(vec3.fromValues(DELTA_TRANS, 0, 0));
            renderTriangles();
            return;
        case "w":    // w — translate view forward along view Z
            translateCamera(vec3.fromValues(0, 0, -DELTA_TRANS));
            renderTriangles();
            return;
        case "s":    // s — translate view backward along view Z
            translateCamera(vec3.fromValues(0, 0, DELTA_TRANS));
            renderTriangles();
            return;
        case "q":    // q — translate view up along view Y
            translateCamera(vec3.fromValues(0, DELTA_TRANS, 0));
            renderTriangles();
            return;
        case "e":    // e — translate view down along view Y
            translateCamera(vec3.fromValues(0, -DELTA_TRANS, 0));
            renderTriangles();
            return;
        case "A":    // A — rotate view left around view Y (yaw)
            rotateCamera(DELTA_ROT, vec3.fromValues(0, 1, 0));
            renderTriangles();
            return;
        case "D":    // D — rotate view right around view Y (yaw)
            rotateCamera(-DELTA_ROT, vec3.fromValues(0, 1, 0));
            renderTriangles();
            return;
        case "W":    // W — rotate view forward around view X (pitch)
            rotateCamera(DELTA_ROT, vec3.fromValues(1, 0, 0));
            renderTriangles();
            return;
        case "S":    // S — rotate view backward around view X (pitch)
            rotateCamera(-DELTA_ROT, vec3.fromValues(1, 0, 0));
            renderTriangles();
            return;
        case "ArrowLeft":    // left — select and highlight the previous triangle set (previous off)
            event.preventDefault();     // Prevent arrow keys change the radio button selection
            changeModel(models, triangleSets, -1);
            return;
        case "ArrowRight":    // right — select and highlight the next triangle set (previous off)
            event.preventDefault();     // Prevent arrow keys change the radio button selection
            changeModel(models, triangleSets, 1);
            return;
        case "ArrowUp":    // up — select and highlight the next ellipsoid (previous off)
            event.preventDefault();     // Prevent arrow keys change the radio button selection
            changeModel(models, ellipsoids, 1);
            return;
        case "ArrowDown":    // down — select and highlight the previous ellipsoid (previous off)
            event.preventDefault();     // Prevent arrow keys change the radio button selection
            changeModel(models, ellipsoids, -1);
            return;
        case " ":    // space — deselect and turn off highlight
            models.selectId = -1;
            if(option.BSPTree) combineModelsInBSP();
            renderTriangles();
            return;
        case "b":    // b — toggle between Phong and Blinn-Phong lighting
            option.lightModel = 0 === option.lightModel ? 1 : 0;
            renderTriangles();
            return;
    }

    // Part 6: Interactively change lighting on a model
    // Part 7: Interactively transform models
    if (-1 !== models.selectId) {
        let model = models.array[models.selectId];
        switch (event.key) {
            case "n":   // n — increment the specular integer exponent by 1 (wrap from 20 to 0)
                model.material.n = (model.material.n + 1) % 21;
                renderTriangles();
                return;
            case "1":   // 1 — increase the ambient weight by 0.1 (wrap from 1 to 0)
                for (let i = 0; i < 3; i++) {
                    model.material.ambient[i] += 0.1;
                    if (model.material.ambient[i] > 1) model.material.ambient[i] = 0.0;
                }
                renderTriangles();
                return;
            case "2":   // 2 — increase the diffuse weight by 0.1 (wrap from 1 to 0)
                for (let i = 0; i < 3; i++) {
                    model.material.diffuse[i] += 0.1;
                    if (model.material.diffuse[i] > 1) model.material.diffuse[i] = 0.0;
                }
                renderTriangles();
                return;
            case "3":   // 3 — increase the specular weight by 0.1 (wrap from 1 to 0)
                for (let i = 0; i < 3; i++) {
                    model.material.specular[i] += 0.1;
                    if (model.material.specular[i] > 1) model.material.specular[i] = 0.0;
                }
                renderTriangles();
                return;
            case "k":   // k — translate selection left along view X
                translateModel(model, camera.X, -DELTA_TRANS);
                return;
            case ";":   // ; — translate selection right along view X
                translateModel(model, camera.X, DELTA_TRANS);
                return;
            case "o":   // o — translate selection forward along view Z
                translateModel(model, camera.Z, -DELTA_TRANS);
                return;
            case "l":   // l — translate selection backward along view Z
                translateModel(model, camera.Z, DELTA_TRANS);
                return;
            case "i":   // i — translate selection up along view Y
                translateModel(model, camera.Y, DELTA_TRANS);
                return;
            case "p":   // p — translate selection down along view Y
                translateModel(model, camera.Y, -DELTA_TRANS);
                return;
            case "K":   // K — rotate selection left around view Y (yaw)
                rotateModel(model, camera.Y, -DELTA_ROT);
                return;
            case ":":   // : — rotate selection right around view Y (yaw)
                rotateModel(model, camera.Y, DELTA_ROT);
                return;
            case "O":   // O — rotate selection forward around view X (pitch)
                rotateModel(model, camera.X, -DELTA_ROT);
                return;
            case "L":   // L — rotate selection backward around view X (pitch)
                rotateModel(model, camera.X, DELTA_ROT);
                return;
            case "I":   // I — rotate selection clockwise around view Z (roll)
                rotateModel(model, camera.Z, -DELTA_ROT);
                return;
            case "P":   // P — rotate selection counterclockwise around view Z (roll)
                rotateModel(model, camera.Z, DELTA_ROT);
                return;
        }
    }
}

function handleKeyUp(event) {
    currentlyPressedKeys[event.keyCode] = false;
}
//endregion

//region Initialize models
// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response);
        } // end if good params
    } // end try

    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get json file

function loadTexture(url) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

    texture.image = new Image();
    texture.image.crossOrigin = "anonymous";
    texture.image.src = url;

    texture.image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);       // Flip image v direction, so v oriented from bottom to top
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    };
    return texture;
}

function initMultitexture() {
    multitexture = loadTexture(INPUT_MULTITEXTURE_URL);
}

function bufferTriangleSet(triangleSet) {
    // send the vertex coords to webGL
    triangleSet.vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleSet.vertexBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleSet.coordArray), gl.STATIC_DRAW); // coords to that buffer

    // send the vertex normals to webGL
    triangleSet.normalBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleSet.normalBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleSet.normalArray), gl.STATIC_DRAW); // normals to that buffer

    // send the triangle indices to webGL
    triangleSet.triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleSet.triangleBuffer); // activate that buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangleSet.indexArray), gl.STATIC_DRAW); // indices to that buffer

    // send the texture to webGL
    triangleSet.texture = loadTexture(INPUT_BASE_URL + triangleSet.material.texture);
    triangleSet.textureUVBuffer = gl.createBuffer(); // init empty triangle index buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, triangleSet.textureUVBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangleSet.uvArray), gl.STATIC_DRAW); // normals to that buffer
}

function initCamera(eye, lookAt, viewUp) {
    camera.xyz = vec3.fromValues(eye[0], eye[1], eye[2]);
    camera.pMatrix = calcPerspective(camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far);

    let center = vec3.fromValues(eye[0] + lookAt[0], eye[1] + lookAt[1], eye[2] + lookAt[2]);
    camera.vMatrix = mat4.lookAt(mat4.create(), eye, center, viewUp);
    updateCameraAxis();
}

// Read triangle sets in
function loadTriangleSets() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    triangleSets.array = [];
    triangleSets.selectId = 0;

    if (inputTriangles != String.null) {
        var whichSetTri; // index of triangle in current triangle set
        var vtxToAdd = []; // vtx coords to add to the coord array

        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            var curSet = inputTriangles[whichSet];
            var triangleSet = {};
            triangleSet.doubleSide = true;
            triangleSet.triBufferSize = 0;
            triangleSet.specularModel = 1;
            triangleSet.material = curSet.material;
            triangleSet.coordArray = []; // 1D array of vertex coords for WebGL
            triangleSet.normalArray = []; // 1D array of vertex normals for WebGL
            triangleSet.indexArray = []; // 1D array of vertex indices for WebGL
            triangleSet.uvArray = []; // 1D array of vertex uvs for WebGL

            // Calculate triangles center
            var triCenter = vec3.create();
            for(let i = 0; i < curSet.vertices.length; i++) {
                vec3.add(triCenter, triCenter, curSet.vertices[i]);
            }
            vec3.scale(triCenter, triCenter, 1.0/curSet.vertices.length);

            // Add coordinates
            for(let i = 0; i < curSet.vertices.length; i++) {
                vtxToAdd = vec3.subtract(vec3.create(), curSet.vertices[i], triCenter);
                triangleSet.coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);
            }

            // Add normals
            for(let i = 0; i < curSet.normals.length; i++)
                triangleSet.normalArray.push(curSet.normals[i][0],curSet.normals[i][1],curSet.normals[i][2]);

            // Add triangles
            for (whichSetTri=0; whichSetTri<curSet.triangles.length; whichSetTri++)
                for (let i = 0; i < 3; i++, triangleSet.triBufferSize++)
                    triangleSet.indexArray.push(curSet.triangles[whichSetTri][i]);

            // Add uvs
            for(let i = 0; i < curSet.uvs.length; i++)
                triangleSet.uvArray.push(curSet.uvs[i][0], curSet.uvs[i][1]);

            // Buffer data arrays into GPU
            bufferTriangleSet(triangleSet);

            // Initialize model transform matrices
            triangleSet.tMatrix = mat4.fromTranslation(mat4.create(), triCenter);
            triangleSet.rMatrix = mat4.identity(mat4.create());

            // Push triangleset into array
            triangleSet.id = models.array.length;
            models.array.push(triangleSet);
            triangleSets.array.push(triangleSet);
        } // end for each triangle set
    } // end if triangles found
} // end load triangleSets

// Read ellipsoid in
function loadEllipsoids() {
    let nLatitude = LATITUDE_COUNT;
    let nLongitude = LONGITUDE_COUNT;
    var inputEllipsoids = getJSONFile(INPUT_ELLIPSOIDS_URL,"ellipsoids");
    ellipsoids.array = [];
    ellipsoids.selectId = 0;

    if (inputEllipsoids != String.null) {
        for (var whichSet=0; whichSet<inputEllipsoids.length; whichSet++) {
            var curSet = inputEllipsoids[whichSet];
            var triangleSet = {};
            triangleSet.doubleSide = false;
            triangleSet.triBufferSize = 0;
            triangleSet.specularModel = 1;
            triangleSet.material = {};
            triangleSet.material.ambient = curSet.ambient;
            triangleSet.material.diffuse = curSet.diffuse;
            triangleSet.material.specular = curSet.specular;
            triangleSet.material.n = curSet.n;
            triangleSet.material.alpha = curSet.alpha;
            triangleSet.material.texture = curSet.texture;
            triangleSet.coordArray = []; // 1D array of vertex coords for WebGL
            triangleSet.normalArray = []; // 1D array of vertex normals for WebGL
            triangleSet.indexArray = []; // 1D array of vertex indices for WebGL
            triangleSet.uvArray = []; // 1D array of vertex uvs for WebGL

            // Create triangles center
            var triCenter = vec3.fromValues(curSet.x, curSet.y, curSet.z);

            // Calculate and add vertices coordinates and normals
            let deltaLat = Math.PI / nLatitude;
            let deltaLong = 2 * Math.PI / nLongitude;
            for(let i = 0, theta = 0.0; i <= nLatitude; i++, theta += deltaLat) {
                let sinT = Math.sin(theta), cosT = Math.cos(theta), v = 1.0 - theta/Math.PI;
                for(let j = 0, phi = 0.0; j <= nLongitude; j++, phi += deltaLong) {
                    let sinP = Math.sin(phi), cosP = Math.cos(phi);
                    let xu = sinP*sinT, yu = cosT, zu = cosP*sinT;
                    triangleSet.coordArray.push(xu * curSet.a, yu * curSet.b, zu * curSet.c);
                    triangleSet.normalArray.push(xu / curSet.a, yu / curSet.b, zu / curSet.c);
                    triangleSet.uvArray.push(phi/Math.PI/2, v)
                }
            }

            // Calculate and add triangles
            for(let i = 0, up = 0, down = nLongitude + 1; i < nLatitude; i++, up = down, down += nLongitude + 1) {
                for(let left = 0, right = 1; left < nLongitude; left++, right++, triangleSet.triBufferSize += 6) {
                    triangleSet.indexArray.push(up + left, down + left, up + right);
                    triangleSet.indexArray.push(down + left, down + right, up + right);
                }
            }

            // Buffer data arrays into GPU
            bufferTriangleSet(triangleSet);

            // Initialize model transform matrices
            triangleSet.tMatrix = mat4.fromTranslation(mat4.create(), triCenter);
            triangleSet.rMatrix = mat4.identity(mat4.create());

            // Push triangleset into array
            triangleSet.id = models.array.length;
            models.array.push(triangleSet);
            ellipsoids.array.push(triangleSet);
        } // end for each ellipsoid
    } // end if ellipsoids found
} // end load ellipsoids

// Update model matrices
function updateModelMatrices(models) {
    var scaleMatrix = mat4.identity(mat4.create());
    mat4.scale(scaleMatrix, scaleMatrix, [1.2, 1.2, 1.2]);
    for(let i = 0; i < models.array.length; i++) {
        models.array[i].mMatrix = mat4.multiply(mat4.create(), models.array[i].tMatrix, models.array[i].rMatrix);
        models.array[i].nMatrix = mat3.normalFromMat4(mat3.create(), models.array[i].rMatrix);
        if (models.selectId === i) {
            models.array[i].mMatrix = mat4.multiply(mat4.create(), models.array[i].mMatrix, scaleMatrix);
        }
    }
}

// Combine models
function combineModelsInArray() {
    models.glVertices = [];
    models.glNormals = [];
    models.triArray = [];
    models.uvArray = [];
    for(let i = 0; i < models.array.length; i++) {
        let model = models.array[i];
        for(let j = 0; j < model.indexArray.length; j++) {
            let baseIndex3 = 3 * model.indexArray[j], baseIndex2 = 2 * model.indexArray[j];
            models.glVertices.push(model.coordArray[baseIndex3], model.coordArray[baseIndex3 + 1], model.coordArray[baseIndex3 + 2]);
            models.glNormals.push(model.normalArray[baseIndex3], model.normalArray[baseIndex3 + 1], model.normalArray[baseIndex3 + 2]);
            models.uvArray.push(model.uvArray[baseIndex2], model.uvArray[baseIndex2 + 1]);
            if(j%3 === 0) models.triArray.push([i, 3 * models.triArray.length, 0.0]);
        }
    }

    updateModelMatrices(models);
    depthSort(models, camera);

    // send the vertex coords to webGL
    models.vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, models.vertexBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(models.glVertices), gl.STATIC_DRAW); // coords to that buffer

    // send the vertex normals to webGL
    models.normalBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, models.normalBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(models.glNormals), gl.STATIC_DRAW); // normals to that buffer

    // send the texture uvs to webGL
    models.textureUVBuffer = gl.createBuffer(); // init empty triangle index buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, models.textureUVBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(models.uvArray), gl.STATIC_DRAW); // normals to that buffer
}

// Combine in BSP tree
function combineModelsInBSP() {
    if(0 === option.transparent) return;
    updateModelMatrices(models);
    bsp = new BSP();
    models.glVertices = [];
    models.glNormals = [];
    models.uvArray = [];
    for(let i = 0; i < models.array.length; i++) {
        let model = models.array[i];
        for(let j = 0; j < model.indexArray.length; j += 3) {
            let baseIndices3 = [3 * model.indexArray[j], 3 * model.indexArray[j + 1], 3 * model.indexArray[j + 2]];
            let baseIndices2 = [2 * model.indexArray[j], 2 * model.indexArray[j + 1], 2 * model.indexArray[j + 2]];
            let tri = new Triangle([i]);
            tri.setByArrayMatrix(model.coordArray, baseIndices3, model.mMatrix);
            tri.setNormalByArray(model.normalArray, baseIndices3);
            tri.setUVByArray(model.uvArray, baseIndices2);
            bsp.add(tri);
        }
    }
    for(let index = 0, stack = [bsp]; stack.length > 0;) {
        let node = stack.pop();
        if(null === node.tri) continue;
        models.glVertices.push( node.tri.p[0][0], node.tri.p[0][1], node.tri.p[0][2],
                                node.tri.p[1][0], node.tri.p[1][1], node.tri.p[1][2],
                                node.tri.p[2][0], node.tri.p[2][1], node.tri.p[2][2]);
        models.glNormals.push(  node.tri.p[0].n[0], node.tri.p[0].n[1], node.tri.p[0].n[2],
                                node.tri.p[1].n[0], node.tri.p[1].n[1], node.tri.p[1].n[2],
                                node.tri.p[2].n[0], node.tri.p[2].n[1], node.tri.p[2].n[2]);
        models.uvArray.push(    node.tri.p[0].uv[0], node.tri.p[0].uv[1],
                                node.tri.p[1].uv[0], node.tri.p[1].uv[1],
                                node.tri.p[2].uv[0], node.tri.p[2].uv[1]);
        node.tri.model[1] = 3 * (index++);
        if(node.front) stack.push(node.front);
        if(node.back) stack.push(node.back);
    }

    // send the vertex coords to webGL
    models.vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, models.vertexBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(models.glVertices), gl.STATIC_DRAW); // coords to that buffer

    // send the vertex normals to webGL
    models.normalBuffer = gl.createBuffer(); // init empty vertex coord buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, models.normalBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(models.glNormals), gl.STATIC_DRAW); // normals to that buffer

    // send the texture uvs to webGL
    models.textureUVBuffer = gl.createBuffer(); // init empty triangle index buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, models.textureUVBuffer); // activate that buffer
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(models.uvArray), gl.STATIC_DRAW); // normals to that buffer

    updateBSP(models, camera, bsp);
}

// Update BSP sequence
function updateBSP(models, camera, bsp) {
    function traverse(models, camera, node) {
        let seq;
        if(node.tri.isFront(camera.xyz)) seq = [node.back, node.front];
        else seq = [node.front, node.back];
        if(seq[0] && seq[0].tri) traverse(models, camera, seq[0]);
        models.triArray.push(node.tri.model);
        if(seq[1] && seq[1].tri) traverse(models, camera, seq[1]);
    }
    models.triArray = [];
    traverse(models, camera, bsp);
}

// TODO: Depth Sort
function depthSort(models, camera) {
    function calcZ(x, y, z, matrix) {
        return matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    }
    function calcTriZ(vertices, base, matrix) {
        let sum = 0;
        for(let i = 0; i < 9; i += 3)
            sum += calcZ(vertices[base+i], vertices[base+i+1], vertices[base+i+2], matrix);
        return sum / 3.0;
    }
    // Suppose matrices are up to date
    let matrices = [];
    for(let i = 0; i < models.array.length; i++)
        matrices[i] = mat4.multiply(mat4.create(), camera.vMatrix, models.array[i].mMatrix);

    // Calculate depth of each triangle
    for(let i = 0; i < models.triArray.length; i++)
        models.triArray[i][2] = - calcTriZ(models.glVertices, 3 * models.triArray[i][1], matrices[models.triArray[i][0]]);

    // Sort
    for(let i = 1; i < models.triArray.length; i++) {
        let temp = models.triArray[i], j;
        for(j = i - 1; j >= 0 && models.triArray[j][2] < temp[2]; j--)
            models.triArray[j + 1] = models.triArray[j];
        models.triArray[j + 1] = temp;
    }
}

// Load lights
function loadLights() {
    // lightArray = getJSONFile(lightsURL, "lights");
    var light = {};
    light.ambient = lightAmbient;
    light.diffuse = lightDiffuse;
    light.specular = lightSpecular;
    light.x = lightPosition[0];
    light.y = lightPosition[1];
    light.z = lightPosition[2];
    lightArray = [light];
}
//endregion

//region Manipulate models
function getLightUniformLocation(program, varName) {
    var lightUniform = {};
    lightUniform.xyz = gl.getUniformLocation(program, varName + ".xyz");
    lightUniform.ambient = gl.getUniformLocation(program, varName + ".ambient");
    lightUniform.diffuse = gl.getUniformLocation(program, varName + ".diffuse");
    lightUniform.specular = gl.getUniformLocation(program, varName + ".specular");
    return lightUniform;
}

function getMaterialUniformLocation(program, varName) {
    var materialUniform = {};
    materialUniform.ambient = gl.getUniformLocation(program, varName + ".ambient");
    materialUniform.diffuse = gl.getUniformLocation(program, varName + ".diffuse");
    materialUniform.specular = gl.getUniformLocation(program, varName + ".specular");
    materialUniform.n = gl.getUniformLocation(program, varName + ".n");
    materialUniform.alpha = gl.getUniformLocation(program, varName + ".alpha");
    return materialUniform;
}

function getOptionUniformLocation(program, varName) {
    var optionUniform = {};
    optionUniform.useLight = gl.getUniformLocation(program, varName + ".useLight");
    optionUniform.lightModel = gl.getUniformLocation(program, varName + ".lightModel");
    optionUniform.transparent = gl.getUniformLocation(program, varName + ".transparent");
    optionUniform.textureTransparent = gl.getUniformLocation(program, varName + ".textureTransparent");
    optionUniform.multitexture = gl.getUniformLocation(program, varName + ".multitexture");
    return optionUniform;
}

function setLightUniform(lightUniform, light) {
    gl.uniform3f(lightUniform.xyz, light.x, light.y, light.z);
    gl.uniform3fv(lightUniform.ambient, light.ambient);
    gl.uniform3fv(lightUniform.diffuse, light.diffuse);
    gl.uniform3fv(lightUniform.specular, light.specular);
}

function setMaterialUniform(materialUniform, material) {
    gl.uniform3fv(materialUniform.ambient, material.ambient);
    gl.uniform3fv(materialUniform.diffuse, material.diffuse);
    gl.uniform3fv(materialUniform.specular, material.specular);
    gl.uniform1f(materialUniform.n, material.n);
    gl.uniform1f(materialUniform.alpha, material.alpha);
}

function setOptionUniform(materialUniform, option) {
    gl.uniform1i(materialUniform.useLight, option.useLight);
    gl.uniform1i(materialUniform.lightModel, option.lightModel);
    gl.uniform1i(materialUniform.transparent, option.transparent);
    gl.uniform1i(materialUniform.textureTransparent, option.textureTransparent);
    gl.uniform1i(materialUniform.multitexture, option.multitexture);
}

function calcPerspective(left, right, top, bottom, near, far) {
    let n = Math.abs(near), f = Math.abs(far);
    let width = right - left, height = top - bottom, deep = f - n;
    var pMatrix = mat4.create();
    pMatrix[0] = 2*n/width;
    pMatrix[1] = 0;
    pMatrix[2] = 0;
    pMatrix[3] = 0;
    pMatrix[4] = 0;
    pMatrix[5] = 2*n/height;
    pMatrix[6] = 0;
    pMatrix[7] = 0;
    pMatrix[8] = (right + left)/width;
    pMatrix[9] = (top + bottom)/height;
    pMatrix[10] = -(f+n)/deep;
    pMatrix[11] = -1;
    pMatrix[12] = 0;
    pMatrix[13] = 0;
    pMatrix[14] = -2*f*n/deep;
    pMatrix[15] = 0;
    return pMatrix;
}

function updateCameraAxis() {
    camera.X = vec3.fromValues(camera.vMatrix[0], camera.vMatrix[4], camera.vMatrix[8]);
    camera.Y = vec3.fromValues(camera.vMatrix[1], camera.vMatrix[5], camera.vMatrix[9]);
    camera.Z = vec3.fromValues(camera.vMatrix[2], camera.vMatrix[6], camera.vMatrix[10]);
}

function rotateCamera(rad, axis) {
    mat4.multiply(camera.vMatrix, mat4.fromRotation(mat4.create(), -rad, axis), camera.vMatrix);
    updateCameraAxis();
    if(option.transparent && option.BSPTree) updateBSP(models, camera, bsp);
}

function translateCamera(vec) {
    for(let i = 0; i < 3; i++) {
        camera.vMatrix[i + 12] -= vec[i];
        camera.xyz[i] += camera.X[i] * vec[0] + camera.Y[i] * vec[1] + camera.Z[i] * vec[2];
    }
    if(option.transparent && option.BSPTree) updateBSP(models, camera, bsp);
}

function rotateModel(model, axis, rotAngle) {
    mat4.multiply(model.rMatrix, mat4.fromRotation(mat4.create(), rotAngle, axis), model.rMatrix);
    if(option.BSPTree) combineModelsInBSP();
    renderTriangles();
}

function translateModel(model, direction, distance) {
    mat4.translate(model.tMatrix, model.tMatrix, vec3.scale(vec3.create(), direction, distance));
    if(option.BSPTree) combineModelsInBSP();
    renderTriangles();
}

function changeModel(models, triangleSets, offset) {
    triangleSets.selectId = (triangleSets.selectId + triangleSets.array.length + offset) % triangleSets.array.length;
    models.selectId = triangleSets.array[triangleSets.selectId].id;
    if(option.BSPTree) combineModelsInBSP();
    renderTriangles();
}
//endregions

//region Render image
// render with element topology
function renderElements(models) {
    for(let i = 0; i < models.array.length; i++) {
        gl.uniform1f(uniforms.doubleSideUniform, models.array[i].doubleSide);
        setMaterialUniform(uniforms.materialUniform, models.array[i].material);

        gl.uniformMatrix4fv(uniforms.mMatrixUniform, false, models.array[i].mMatrix);
        gl.uniformMatrix3fv(uniforms.nMatrixUniform, false, models.array[i].nMatrix);

        // vertex buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, models.array[i].vertexBuffer); // activate
        gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

        // vertex normal buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, models.array[i].normalBuffer); // activate
        gl.vertexAttribPointer(vertexNormalAttrib,3,gl.FLOAT,false,0,0); // feed

        // texture uvs buffer: activate and feed into vertex shader
        gl.bindBuffer(gl.ARRAY_BUFFER, models.array[i].textureUVBuffer); // activate
        gl.vertexAttribPointer(textureUVAttrib,2,gl.FLOAT,false,0,0); // feed

        // update texture uniform
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, models.array[i].texture);
        gl.uniform1i(uniforms.textureUniform, 0);

        // triangle buffer: activate and render
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, models.array[i].triangleBuffer); // activate
        gl.drawElements(gl.TRIANGLES, models.array[i].triBufferSize,gl.UNSIGNED_SHORT,0); // render
    }
}

// render by triangle array
function renderArrays(models) {
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, models.vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

    // vertex normal buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, models.normalBuffer); // activate
    gl.vertexAttribPointer(vertexNormalAttrib,3,gl.FLOAT,false,0,0); // feed

    // texture uvs buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, models.textureUVBuffer); // activate
    gl.vertexAttribPointer(textureUVAttrib,2,gl.FLOAT,false,0,0); // feed

    // Sort triangles
    if(1 === option.transparent && 1 === option.depthSort) depthSort(models, camera);

    // set identity matrix
    let eMatrix = mat4.create();

    for (let i = 0; i < models.triArray.length; i++) {
        let modelIndex = models.triArray[i][0];

        gl.uniform1f(uniforms.doubleSideUniform, models.array[modelIndex].doubleSide);
        setMaterialUniform(uniforms.materialUniform, models.array[modelIndex].material);

        if (option.BSPTree && option.transparent) {
            gl.uniformMatrix4fv(uniforms.mMatrixUniform, false, eMatrix);
        } else {
            gl.uniformMatrix4fv(uniforms.mMatrixUniform, false, models.array[modelIndex].mMatrix);
        }
        gl.uniformMatrix3fv(uniforms.nMatrixUniform, false, models.array[modelIndex].nMatrix);

        // update texture uniform
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, models.array[modelIndex].texture);
        gl.uniform1i(uniforms.textureUniform, 0);

        // triangle buffer: activate and render
        gl.drawArrays(gl.TRIANGLES, models.triArray[i][1], 3); // render
    }
}

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers

    // Initialize blending
    if (1 === option.transparent) {
        // gl.blendFunc(gl.SRC_ALPHA, 0 === option.depthSort? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.BLEND);
        gl.depthMask(false);
        gl.disable(gl.DEPTH_TEST);
    } else {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
    }

    // Initialize lights
    for (let i = 0; i < lightArray.length; i++) {
        setLightUniform(uniforms.lightUniformArray[i], lightArray[i]);
    }
    // Initialize options
    setOptionUniform(uniforms.optionUniform, option);

    // Initialize camera
    gl.uniform3fv(uniforms.cameraPosUniform, camera.xyz);

    // Initialize viewport transform
    gl.uniformMatrix4fv(uniforms.vMatrixUniform, false, camera.vMatrix);

    // Initialize projection transform
    gl.uniformMatrix4fv(uniforms.pMatrixUniform, false, camera.pMatrix);

    // update multitexture uniform
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, multitexture);
    gl.uniform1i(uniforms.multitextureUniform, 1);

    // Update model transform
    updateModelMatrices(models);

    // Render models
    if(option.transparent || (option.depthSort || option.BSPTree )) {
        renderArrays(models);
    } else {
        renderElements(models);
    }
} // end render triangles
//endregion

function refresh() {
    let preBST = option.BSPTree, preTransparent = option.transparent;
    loadDocumentInputs();
    loadLights(); // load in the lights
    setupWebGL(); // set up the webGL environment
    camera.pMatrix = calcPerspective(camera.left, camera.right, camera.top, camera.bottom, camera.near, camera.far);
    if(option.BSPTree && option.transparent && (!preBST || !preTransparent)) {
        combineModelsInBSP();
    } else if(option.depthSort || (!option.BSPTree && preBST) || (!option.transparent && preTransparent)) {
        combineModelsInArray();
    }
    setupShaders(); // setup the webGL shaders
    renderTriangles();
}

var lastTime = 0;
function animate(now) {
    if(1 === option.BSPTree) return;
    if(now - lastTime > 100) {
        lastTime = now;
        renderTriangles();
    }
    requestAnimationFrame(animate);
}

/* MAIN -- HERE is where execution begins after window load */

function main() {
    loadDocumentInputs();   // load the data from html page
    loadLights(); // load in the lights
    setupWebGL(); // set up the webGL environment
    initCamera(defaultEye, LookAt, ViewUp); // Initialize camera
    loadTriangleSets(); // load in the triangles from tri file
    loadEllipsoids(); // load in the ellipsoids from ellipsoids file
    combineModelsInArray();
    initMultitexture();
    setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL
    setupKeyEvent();
    requestAnimationFrame(animate);
  
} // end main
