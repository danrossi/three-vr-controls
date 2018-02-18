/**
 * Copyright 2018 Daniel Rossi
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

import VRControlsUtils from './VRControlsUtils';

export default class VRControls extends Reticulum {
    
    constructor(camera, renderer, options) {
        options.isClickEnabled = false;
        super(camera, options);
        this.renderer = renderer,
        this.tempMatrix = new Matrix4(),

        //default distance of the raycaster marker
        this.defaultMarkerDistance = options.defaultMarkerDistance || 10;

        //default scale of raycaster marker to be used to re-calculate scale
        this.defaultMarkerScale = options.defaultMarkerScale || 0.07,
        this.updateMethod = this.updateReticle;

         //default scale fraction
        this.scaleFraction = this.defaultMarkerScale / this.defaultMarkerDistance;
    }

    /**
     * Initiate reticulum and vr controller
     */
    initiate(camera, options) {
        super.initiate(camera, options);
        window.addEventListener('vr controller connected', (e) => this.onControllerConnected(e));
    	window.addEventListener('vr controller disconnected', (e) => this.onControllerDisconnected(e));
    }

    /**
     * VR Controller connecected event
     */
    onControllerConnected(event) {
        
        //initiate the controller
        this.initController(event);

        //change update method to vr controller instead of reticle
        this.updateMethod = this.updateVRController;
        
        //setup vr controller events
        this.controller.addEventListener('primary press began', (event) => this.onControllerPress(event));
        this.controller.addEventListener('primary press ended', (event) => this.onControllerPressEnd(event));
        this.controller.addEventListener('disconnected',  (event) => this.onControllerDisconnected(event));
    }

    /**
     * Initiate the controller
     * Sends an event for adding models to the controller
     * Adds a laser line and marker pointer
     */
    initController(event) { 
        this.controller = event.detail;
       // this.scene.add(this.controller);
        
        //these might need to be selected on type of controller
        this.controller.standingMatrix = this.renderer.vr.getStandingMatrix();
        this.controller.head = this.camera;

        this.showRecticle = false;
        
        this.dispatchEvent({ type: "connected"}, this.controller);

        //create the laser line pointer
        this.createLaserLine();

        //create the marker
        this.createMarker();
    }

    /**
     * Create the marker pointer for object selection
     */
    createMarker() {
        const geometry = new THREE.CircleBufferGeometry( 1, 32 ),
        material = VRControlsUtils.createShaderMaterial(0xffffff);

        const laserMarker = this.laserMarker = new THREE.Mesh(geometry, material);
        laserMarker.name = "marker";

        //set the default scale
        laserMarker.scale.set(this.defaultMarkerScale, this.defaultMarkerScale, 1);

        //set the default position
        laserMarker.position.z = -this.defaultMarkerDistance;

        laserMarker.visible = false;

        this.controller.add(laserMarker);
    }

    /**
     * Create the laser pointer with alpha fade
     */
    createLaserLine() {

        const lineMaterial = VRControlsUtils.createLineShaderMaterial(0xffffff),
        laserLine = this.laserLine = new Line(new BufferGeometry(), lineMaterial);

        laserLine.geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 0, 0, -this.defaultMarkerDistance ], 3 ) );
        laserLine.name = 'line';
        laserLine.visible = false;
        this.controller.add(laserLine);
    }

    /**
     * On controller disconnect return to the reticulum controls
     */
    onControllerDisconnected(event) {
    	this.controller.parent.remove( this.controller );
    	this.controller = null;
    	this.updateMethod = super.update;
    }

    /**
     * On VR controller button press
     */
    onControllerPress(event) {


        if (this.controller.userData.selected !== undefined) {
            const object = this.controller.userData.selected;
            if (object.onGazeClick != null) {
                object.onGazeClick(object);
            }
        } else {
            //clicking outside of a raycaster selection
            //useful to hiding / showing ui
            this.dispatchEvent({ type: "click" });
        }
    }

    /**
     * VR Controller press end
     */
    onControllerPressEnd(event) {
        if (this.controller.userData.selected !== undefined) {
            const object = this.controller.userData.selected;
            if (object.onGazeOut != null) {
                object.onGazeOut(object);
            }
            
            this.controller.userData.selected = undefined;
        }
    }

    /**
     * Update raycaster matrix from the VR Controller position
     */
    updateRaycaster() {
        const tempMatrix = this.tempMatrix,
            matrixWorld = this.controller.matrixWorld;

        tempMatrix.identity().extractRotation(matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    }

    /**
     * Update the laser line distance to the raycaster intersect object
     */
    updateLaserLine(distance) {
        const laserLine = this.laserLine,
        positionArray = laserLine.geometry.attributes.position.array;
        laserLine.geometry.attributes.position.setZ(1, distance);
        laserLine.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * Intersect objects determined by intersect objects added to Reticulum
     */
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
                    distance = intersection.distance;
                   // line = this.controller.getObjectByName('line');
        
                object.point = intersection.point;
                this.controller.userData.selected = object;

                if (object.onGazeOver != null) {
          			object.onGazeOver(object);
      			}

                this.updateLaserLine(-distance);
                this.scaleAndPositionMarker(distance, object);
               
                //if (line) {
                //	this.updateLaserLine(line, intersection.distance, intersection.object);
                //}
            }
        } else {
            if (this.controller.userData.selected) {
               this.resetSelectedObject(); 
            }
        }
    }

    /**
     * Scale and reposition marker depending on the distance of the intersect object
     */
    scaleAndPositionMarker(distance, object) {

        //to fix a distance bug add an offset to the boundingsphere or else marker displays in the middle.
        distance -= object.geometry.boundingSphere.radius;
        //this.laserMarker.position.z = -distance;

        this.updateMarkerDistance(-distance);

        //calculate a scale from the default scale to the current distance. 
        //This keeps constant scaling ratio of the marker
        const scale = this.scaleFraction * distance;
        this.scaleMarker(scale);
    }

    /**
     * Update the current scale of the marker
     */
    scaleMarker(scale) {
        const laserMarker = this.laserMarker;
        laserMarker.scale.x = laserMarker.scale.y = scale;
    }

    updateMarkerDistance(distance) {
        this.laserMarker.position.z = distance;
    }

    /**
     * Reset the currently selected intersect object
     */
    resetSelectedObject() {
        const object = this.controller.userData.selected;

        if (object.onGazeOut != null ) {
            object.onGazeOut(object);
        }

        this.controller.userData.selected = undefined;

        //reset the laserline to default
        this.updateLaserLine(-this.defaultMarkerDistance);

        this.updateMarkerDistance(-this.defaultMarkerDistance);

        //reset the scale of the marker to default
        this.scaleMarker(this.defaultMarkerScale);

        //const line = this.controller.getObjectByName('line');

        //if (line) {
          //  this.updateLaserLine(line, -10, intersection.object);
        //}
    }

    /**
     * Update the VR Controller
     */
    updateVRController() {
        THREE.VRController.update()
        this.intersectObjects();
    }

    /**
     * Not in VR mode update the reticle instead
     */
    updateReticle() {
    	THREE.VRController.update();
    	super.update();
    }

    /**
     * Main update method
     */
    update() {
        this.updateMethod();
    }

    /*
     * Toggle the visibility of the controller
     */
    set toggle(value) {
        if (this.controller) {
            this.laserLine.visible = this.laserMarker.visible = value;
            //const line = this.controller.getObjectByName('line');
            //line.visible = value;
        } else {
            this.showRecticle = value;
        }
    }
}