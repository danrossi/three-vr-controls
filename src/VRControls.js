/**
 * Copyright 2016 Daniel Rossi
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


import Reticulum from '../Reticulum/src/Reticulum';
import ReticleUtil from '../Reticulum/src/ReticleUtil';
import { Line } from '../../three.js/src/objects/Line';
import { BufferGeometry } from '../../three.js/src/core/BufferGeometry';
import { LineBasicMaterial } from '../../three.js/src/materials/LineBasicMaterial';
import { Float32BufferAttribute } from '../../three.js/src/core/BufferAttribute';
import { Matrix4 } from '../../three.js/src/math/Matrix4';

export default class VRControls extends Reticulum {
    
    constructor(camera, scene, renderer, options) {
        options.isClickEnabled = false;
        super(camera, options);
        this.renderer = renderer,
        this.scene = scene,
        this.tempMatrix = new Matrix4(),
        //renderer.domElement.addEventListener("click", (e) => {
        //    e.preventDefault();
        //    this.dispatchEvent("click");
        //});
        this.updateMethod = this.updateReticle;
    }
    initiate(camera, options) {
        super.initiate(camera, options);
        window.addEventListener('vr controller connected', (e) => this.onControllerConnected(e));
    	window.addEventListener('vr controller disconnected', (e) => this.onControllerDisconnected(e));
    }
    onControllerConnected(event) {
        this.controller = event.detail;
        this.scene.add(this.controller);
        this.controller.standingMatrix = this.renderer.vr.getStandingMatrix();
        this.controller.head = this.camera;


		const lineMaterial = ReticleUtil.createShaderMaterial(0xffffff, 1, false),
		laserLine = new Line(new BufferGeometry(), lineMaterial);
       // const laserLine = new Line(new BufferGeometry(), new LineBasicMaterial({
       //     linewidth: 1
       // }));
       	lineMaterial.linewidth = 1;
        laserLine.geometry.addAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -10], 3));
        laserLine.name = 'line';
        laserLine.visible = false;
        this.controller.add(laserLine);

        const geometry = new THREE.CircleBufferGeometry( 1, 32 ),
        material = THREE.ReticleUtil.createMorphShaderMaterial(0xffffff, 1, false),
        mesh = new THREE.Mesh(geometry, material);

        mesh.scale.set(0.01, 0.01, 0.01);
        mesh.position.z = -5;

        laserLine.add(mesh);

        this.updateMethod = this.updateVRController;
        this.dispatchEvent({ type: "connected"}, this.controller);
        this.controller.addEventListener('primary press began', (event) => this.onControllerPress(event));
        this.controller.addEventListener('primary press ended', (event) => this.onControllerPressEnd(event));
        this.controller.addEventListener('disconnected',  (event) => this.onControllerDisconnected(event));
    }

    onControllerDisconnected(event) {
    	this.controller.parent.remove( this.controller );
    	this.controller = null;
    	this.updateMethod = super.update;
    }

    onControllerPress(event) {


        if (this.controller.userData.selected !== undefined) {
            const object = this.controller.userData.selected;
            if (object.onGazeClick != null) {
                object.onGazeClick(object);
            }
        } else {
 
            this.dispatchEvent({ type: "click" });
        }
    }
    onControllerPressEnd(event) {
        if (this.controller.userData.selected !== undefined) {
            const object = this.controller.userData.selected;
            if (object.onGazeOut != null) {
                object.onGazeOut(object);
            }
            
            this.controller.userData.selected = undefined;
        }
    }
    updateRaycaster() {
        const tempMatrix = this.tempMatrix,
            matrixWorld = this.controller.matrixWorld;

        tempMatrix.identity().extractRotation(matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    }

    updateLaserLine(line, distance) {
        const positionArray = line.geometry.attributes.position.array;
        positionArray[5] = distance;
        line.geometry.attributes.position.needsUpdate = true;
    }

    intersectObjects() {
        // Do not highlight when already selected
        //if (controller.userData.selected !== undefined) {
        //controller.userData.selected.material.color.setHex( controller.userData.currentHex );
        //return;
        //}
        this.updateRaycaster();
        const intersections = this.intersections;

        if (intersections.length > 0) {

            if (this.controller.userData.selected != intersections[0].object) {
                const intersection = intersections[0],
                    object = intersection.object,
                    line = this.controller.getObjectByName('line');
        
                object.point = intersection.point;
                this.controller.userData.selected = object;

                if (object.onGazeOver != null) {
          			object.onGazeOver(object);
      			}
               
                if (line) {
                	this.updateLaserLine(line, intersection.point.z);
                }
            }
        } else {
            if (this.controller.userData.selected) {
               
                const object = this.controller.userData.selected;

                if (object.onGazeOut != null ) {
          			object.onGazeOut(object);
      			}

                this.controller.userData.selected = undefined;

               	const line = this.controller.getObjectByName('line');
                if (line) {
                    this.updateLaserLine(line, -10);
                }
            }
        }
    }

    updateVRController() {
        THREE.VRController.update()
        this.intersectObjects();
    }

    updateReticle() {
    	THREE.VRController.update();
    	super.update();
    }

    update() {
        this.updateMethod();
    }

    set toggle(value) {
        if (this.controller) {
            const line = this.controller.getObjectByName('line');
            line.visible = value;
        } else {
            this.showRecticle = value;
        }
    }
}