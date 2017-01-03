class Scene {
  constructor(gl, model, file) {
    // Load gltf file
    var json;
    $.get(file, function(response) {
      json = response;
    });
    var gltf = JSON.parse(json);

    this.modelPath = model;

    var meshes = gltf.meshes;
    var primitives = meshes[Object.keys(meshes)[0]].primitives;
    for (var i = 0; i < primitives.length; i++) {
      var primitive = primitives[Object.keys(primitives)[i]];
    
      // Attributes
      for (var attribute in primitive.attributes) {
        getAccessorData(this, gl, gltf, model, primitive.attributes[attribute], attribute);
      }
       
      // Indices
      var indicesAccessor = primitive.indices;
      getAccessorData(this, gl, gltf, model, indicesAccessor, "INDEX");

      // Material
      var materialName = primitive.material;
      this.material = gltf.materials[materialName].extensions.FRAUNHOFER_materials_pbr.values;
      this.initTextures(gl, gltf);
    }
  }

  initBuffers(gl, gltf) {
    var indexBuffer = gl.createBuffer();
    if (!indexBuffer) {
      console.log('Failed to create the buffer object');
      return -1;
    }
  
    if (!initArrayBuffer(gl, this.vertices, 3, gl.FLOAT, 'a_Position', this.verticesAccessor.byteStride, this.verticesAccessor.byteOffset)) {
      return -1;
    }  

    if (!initArrayBuffer(gl, this.normals, 3, gl.FLOAT, 'a_Normal', this.normalsAccessor.byteStride, this.normalsAccessor.byteOffset)) {
      return -1;
    }

    if (!initArrayBuffer(gl, this.texcoords, 2, gl.FLOAT, 'a_UV', this.texcoordsAccessor.byteStride, this.texcoordsAccessor.byteOffset)) {
      return -1;
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);
    
  }

  initTextures(gl, gltf) {

    // Base Color
    var baseColorTexInfo = gltf.textures[this.material.baseColorTexture];
    var baseColorSrc = this.modelPath + gltf.images[baseColorTexInfo.source].uri;
    var baseColorTex = gl.createTexture();
    var u_BaseColorSampler = gl.getUniformLocation(gl.program, 'u_BaseColorSampler');
    gl.activeTexture(gl.TEXTURE0);
    var baseColorImage = new Image();
    baseColorImage.onload = function(e) {
      gl.bindTexture(gl.TEXTURE_2D, baseColorTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, baseColorTexInfo.flipY);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, baseColorImage);
    }
    gl.uniform1i(u_BaseColorSampler, 0);
    baseColorImage.src = baseColorSrc;
  }

  drawScene(gl, modelMatrix, viewMatrix, projectionMatrix, u_mvpMatrix, u_NormalMatrix) {
    // Update model matrix
    modelMatrix = mat4.create();
    mat4.rotateY(modelMatrix, modelMatrix, roll);
    mat4.rotateX(modelMatrix, modelMatrix, pitch);

    // Update mvp matrix
    var mvpMatrix = mat4.create();
    mat4.multiply(mvpMatrix, viewMatrix, modelMatrix);
    mat4.multiply(mvpMatrix, projectionMatrix, mvpMatrix);
    gl.uniformMatrix4fv(u_mvpMatrix, false, mvpMatrix);

    // Update normal matrix
    var normalMatrix = mat4.create();
    mat4.invert(normalMatrix, modelMatrix);
    mat4.transpose(normalMatrix, normalMatrix);
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix); 

    // Draw
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (this.indicesAccessor != null) {
      gl.drawElements(gl.TRIANGLES, this.indicesAccessor.count, gl.UNSIGNED_SHORT, 0);
    }
  }
}

var semaphore = 0;
function getAccessorData(scene, gl, gltf, model, accessorName, attribute) {
  semaphore++;
  var accessor = gltf.accessors[accessorName];
  var bufferView = gltf.bufferViews[accessor.bufferView];
  var buffer = gltf.buffers[bufferView.buffer];
  var bin = buffer.uri;

  var reader = new FileReader();

  reader.onload = function(e) {
    var arrayBuffer = reader.result;
    var start = bufferView.byteOffset;
    var end = start + bufferView.byteLength;
    var slicedBuffer = arrayBuffer.slice(start, end);
    var data;
    if (accessor.componentType === 5126) {
      data = new Float32Array(slicedBuffer);
    }
    else if (accessor.componentType === 5123) {
      data = new Uint16Array(slicedBuffer);
    }
    switch (attribute) {
      case "POSITION": scene.vertices = data;
        scene.verticesAccessor = accessor;
        break;
      case "NORMAL": scene.normals = data;
        scene.normalsAccessor = accessor;
        break;
      case "TEXCOORD_0": scene.texcoords = data;
        scene.texcoordsAccessor = accessor;
        break;
      case "TANGENT": scene.tangents = data;
        scene.tangentsAccessor = accessor;
        break;
      case "INDEX": scene.indices = data;
        scene.indicesAccessor = accessor;
        break;
    }

    semaphore--;
    if (semaphore === 0) {
      scene.initBuffers(gl, gltf);
    }
  }
 
  var oReq = new XMLHttpRequest();
  oReq.open("GET", model + bin, true);
  oReq.responseType = "blob";
  oReq.onload = function(e) {
    var blob = oReq.response;
    reader.readAsArrayBuffer(blob);
  };
  oReq.send();
}

function initArrayBuffer(gl, data, num, type, attribute, stride, offset) {
  var buffer = gl.createBuffer();
  if (!buffer) {
    console.log('Failed to create the buffer object');
    return -1;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  
  var a_attribute = gl.getAttribLocation(gl.program, attribute);
  
  gl.vertexAttribPointer(a_attribute, num, type, false, stride, offset);
  
  gl.enableVertexAttribArray(a_attribute);
  return true;
}