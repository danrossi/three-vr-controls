import ReticleUtil from '../Reticulum/src/ReticleUtil';
import { RawShaderMaterial } from '../../three.js/src/materials/RawShaderMaterial';

export default class VRControlsUtils extends ReticleUtil {
	
  static get lineFragmentShader() {
        return `
            precision highp float;
            precision highp int;
            uniform vec3 color;
            uniform float opacity;
            varying vec4 vPos;
            float limitDistance = 2.0;
            void main() {
              float distance = clamp(length(vPos), 0., limitDistance);
              float opacity = 1. - distance / limitDistance;
              gl_FragColor = vec4(color, opacity);
            }
        `;
  }

  static get vertexShader() {
        return `
            attribute vec2 uv;
            attribute vec4 position;
            varying vec4 vPos;
            uniform mat4 projectionMatrix;
            uniform mat4 modelViewMatrix;
            void main() {
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * position;
            }
        `;
    }

	static createShaderMaterial(color, opacity, transparent) {
    
    const material = super.createShaderMaterial(color, opacity, transparent);
    material.vertexShader = VRControlsUtils.vertexShader;
    material.fragmentShader = VRControlsUtils.fragmentShader;
    
    return material;
  }

  static createLineShaderMaterial(color, lineDistance = 2.0) {
    
    const material = this.createShaderMaterial(color, 1, true);
    material.fragmentShader = VRControlsUtils.lineFragmentShader;
    material.uniforms.limitDistance = { value: lineDistance };
    
    return material;
  }

}