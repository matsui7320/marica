import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';

export class TrackEnvironment {
  readonly group = new THREE.Group();
  private treePositions: { x: number; y: number; z: number; scale: number }[] = [];

  build(spline: TrackSpline, envType: string): void {
    this.clear();
    this.buildGuardrails(spline, envType);
    this.buildTrees(spline, envType);
    this.buildRocks(spline, envType);
    this.buildGround(spline, envType);
    if (envType !== 'night') this.buildClouds(envType);
    // if (envType === 'meadow') this.buildFlowers(spline);
    if (envType === 'frozen') this.buildSnow(spline);
    if (envType === 'coastal') this.buildWater();
    if (envType === 'night') this.buildNightExtras(spline);
    if (envType === 'volcano') this.buildVolcano(spline);
  }

  private buildGuardrails(spline: TrackSpline, envType: string): void {
    if (envType === 'night') {
      this.buildFancyGuardrails(spline);
      return;
    }

    // Standard metal guardrails for non-night stages
    // Posts
    const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.9, 6);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc, metalness: 0.7, roughness: 0.25,
    });
    const postCount = Math.floor(spline.sampleCount * 0.25);
    const postMesh = new THREE.InstancedMesh(postGeo, postMat, postCount * 2);
    postMesh.castShadow = true;

    const railGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 });
    const railMesh = new THREE.InstancedMesh(railGeo, railMat, postCount * 2);

    const capGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xff2200, emissive: 0x441100, emissiveIntensity: 0.2,
    });
    const capMesh = new THREE.InstancedMesh(capGeo, capMat, postCount * 2);

    const dummy = new THREE.Object3D();
    let idx = 0;
    const postPositions: THREE.Vector3[][] = [[], []];

    for (let i = 0; i < postCount; i++) {
      const t = i / postCount;
      const sp = spline.getPointAt(t);
      const hw = sp.width * 0.5 + 0.3;

      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        const basePos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * hw));
        const postUp = sp.normal.clone();
        const postTop = basePos.clone().add(postUp.clone().multiplyScalar(0.9));
        const postCenter = basePos.clone().add(postUp.clone().multiplyScalar(0.45));

        dummy.position.copy(postCenter);
        dummy.quaternion.identity();
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), postUp);
        dummy.updateMatrix();
        postMesh.setMatrixAt(idx, dummy.matrix);

        dummy.position.copy(postTop);
        dummy.quaternion.identity();
        dummy.updateMatrix();
        capMesh.setMatrixAt(idx, dummy.matrix);

        postPositions[s].push(postTop.clone().sub(postUp.clone().multiplyScalar(0.15)));
        idx++;
      }
    }

    let railIdx = 0;
    for (let s = 0; s < 2; s++) {
      const positions = postPositions[s];
      for (let i = 0; i < positions.length; i++) {
        const p0 = positions[i];
        const p1 = positions[(i + 1) % positions.length];
        const mid = p0.clone().add(p1).multiplyScalar(0.5);
        const dir = p1.clone().sub(p0);
        const len = dir.length();
        dir.normalize();

        dummy.position.copy(mid);
        dummy.quaternion.identity();
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        dummy.scale.set(1, len, 1);
        dummy.updateMatrix();
        railMesh.setMatrixAt(railIdx, dummy.matrix);
        railIdx++;
      }
    }

    postMesh.instanceMatrix.needsUpdate = true;
    railMesh.instanceMatrix.needsUpdate = true;
    capMesh.instanceMatrix.needsUpdate = true;
    this.group.add(postMesh);
    this.group.add(railMesh);
    this.group.add(capMesh);
  }

  /** Starlight Highway: fancy crystalline guardrails with rainbow glow */
  private buildFancyGuardrails(spline: TrackSpline): void {
    const dummy = new THREE.Object3D();
    const postCount = Math.floor(spline.sampleCount * 0.35);

    const rainbowColors = [
      0xff3355, 0xff8833, 0xffee33, 0x33ff77, 0x33aaff, 0x7733ff, 0xff33cc,
    ];

    // ── Crystal posts (tapered octagonal prisms with glow) ──
    const crystalGeo = new THREE.ConeGeometry(0.18, 1.8, 8);
    const crystalMeshes: THREE.InstancedMesh[] = [];
    for (const rc of rainbowColors) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xeeeeff, emissive: rc, emissiveIntensity: 3.5,
        metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.9,
      });
      crystalMeshes.push(new THREE.InstancedMesh(crystalGeo, mat, postCount * 2));
    }
    // Crystal glow halos
    const crystalGlowGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const crystalGlowMeshes: THREE.InstancedMesh[] = [];
    for (const rc of rainbowColors) {
      const mat = new THREE.MeshBasicMaterial({
        color: rc, transparent: true, opacity: 0.12,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      crystalGlowMeshes.push(new THREE.InstancedMesh(crystalGlowGeo, mat, postCount * 2));
    }

    // ── Star-shaped toppers ──
    const starShape = new THREE.Shape();
    const starPoints = 5;
    const outerR = 0.22;
    const innerR = 0.09;
    for (let i = 0; i < starPoints * 2; i++) {
      const angle = (i * Math.PI) / starPoints - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      if (i === 0) starShape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else starShape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    starShape.closePath();
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.06, bevelEnabled: false });
    const starMeshes: THREE.InstancedMesh[] = [];
    for (const rc of rainbowColors) {
      const mat = new THREE.MeshStandardMaterial({
        color: rc, emissive: rc, emissiveIntensity: 5.0,
        transparent: true, opacity: 0.95,
      });
      starMeshes.push(new THREE.InstancedMesh(starGeo, mat, postCount * 2));
    }

    // ── Ribbon rail (flowing ribbon connecting posts) ──
    // Build as a continuous tube per side using spline-sampled points
    const ribbonPointsL: THREE.Vector3[] = [];
    const ribbonPointsR: THREE.Vector3[] = [];
    const ribbonSamples = Math.min(postCount, 300);

    let idx = 0;
    for (let i = 0; i < postCount; i++) {
      const t = i / postCount;
      const sp = spline.getPointAt(t);
      const hw = sp.width * 0.5 + 0.3;
      const postUp = sp.normal.clone();

      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        const basePos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * hw));
        const topPos = basePos.clone().add(postUp.clone().multiplyScalar(1.2));

        // Crystal post
        const colorIdx = idx % rainbowColors.length;
        dummy.position.copy(basePos).add(postUp.clone().multiplyScalar(0.9));
        dummy.quaternion.identity();
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), postUp);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        crystalMeshes[colorIdx].setMatrixAt(idx, dummy.matrix);

        // Crystal glow halo
        crystalGlowMeshes[colorIdx].setMatrixAt(idx, dummy.matrix);

        // Star topper
        const starColorIdx = (idx + 2) % rainbowColors.length;
        dummy.position.copy(topPos).add(postUp.clone().multiplyScalar(0.12));
        dummy.quaternion.identity();
        dummy.updateMatrix();
        starMeshes[starColorIdx].setMatrixAt(idx, dummy.matrix);

        // Collect ribbon rail points
        const ribbonPos = basePos.clone().add(postUp.clone().multiplyScalar(0.7));
        if (s === 0) ribbonPointsL.push(ribbonPos);
        else ribbonPointsR.push(ribbonPos);

        idx++;
      }
    }

    for (const cm of crystalMeshes) { cm.count = idx; cm.instanceMatrix.needsUpdate = true; this.group.add(cm); }
    for (const gm of crystalGlowMeshes) { gm.count = idx; gm.instanceMatrix.needsUpdate = true; this.group.add(gm); }
    for (const sm of starMeshes) { sm.count = idx; sm.instanceMatrix.needsUpdate = true; this.group.add(sm); }

    // ── Build ribbon rails as glowing tubes ──
    for (let s = 0; s < 2; s++) {
      const pts = s === 0 ? ribbonPointsL : ribbonPointsR;
      if (pts.length < 4) continue;

      // Subsample for performance (every Nth point)
      const step = Math.max(1, Math.floor(pts.length / ribbonSamples));
      const sampled: THREE.Vector3[] = [];
      for (let i = 0; i < pts.length; i += step) sampled.push(pts[i]);
      sampled.push(pts[0]); // close the loop

      const ribbonCurve = new THREE.CatmullRomCurve3(sampled, true, 'catmullrom', 0.3);

      // Core ribbon
      const ribbonGeo = new THREE.TubeGeometry(ribbonCurve, sampled.length * 2, 0.06, 6, true);
      const ribbonMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xccddff, emissiveIntensity: 3.5,
        metalness: 0.0, roughness: 0.2, transparent: true, opacity: 0.9,
      });
      this.group.add(new THREE.Mesh(ribbonGeo, ribbonMat));

      // Inner glow ribbon
      const glowGeo1 = new THREE.TubeGeometry(ribbonCurve, sampled.length * 2, 0.18, 6, true);
      const glowMat1 = new THREE.MeshBasicMaterial({
        color: 0xaaccff, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.group.add(new THREE.Mesh(glowGeo1, glowMat1));

      // Outer glow ribbon (wide halo)
      const glowGeo2 = new THREE.TubeGeometry(ribbonCurve, sampled.length * 2, 0.4, 6, true);
      const glowMat2 = new THREE.MeshBasicMaterial({
        color: 0x88bbff, transparent: true, opacity: 0.06,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.group.add(new THREE.Mesh(glowGeo2, glowMat2));
    }
  }

  /** Compute y for scenery/terrain: near track = track height, far = ground level (-0.5) */
  private static groundY(trackY: number, distFromEdge: number): number {
    // Stay at track height up to 12 units from edge, then smoothly blend to -0.5 over 30 more units
    const t = Math.min(Math.max((distFromEdge - 12) / 30, 0), 1);
    // Use smoothstep for a gentle slope instead of a sharp linear drop
    const s = t * t * (3 - 2 * t);
    const baseY = trackY * (1 - s) + (-0.5) * s;
    // Offset ground below road surface to prevent z-fighting; larger near track, fades with distance
    const zOffset = 0.35 * (1 - Math.min(distFromEdge / 15, 1));
    return baseY - zOffset;
  }

  /**
   * Check if a world XZ position is too close to any section of the track.
   * Returns null if the position is on/near the road (should be rejected),
   * or { y, edgeDist } for proper ground placement if safe.
   */
  private static checkTrackClearance(
    spline: TrackSpline, pos: THREE.Vector3, margin: number,
  ): { y: number; edgeDist: number } | null {
    // Full search (no hint) to find the globally closest track point
    const closestT = spline.findClosestT(pos);
    const sp = spline.getPointAt(closestT);
    const hw = sp.width * 0.5;

    // XZ distance to the track centerline
    const dx = pos.x - sp.position.x;
    const dz = pos.z - sp.position.z;
    const xzDist = Math.sqrt(dx * dx + dz * dz);

    const edgeDist = xzDist - hw;
    if (edgeDist < margin) return null; // too close to ANY track section

    // Reject placement near antigravity sections (vertical loops, barrel rolls)
    // to prevent scenery from floating at elevated track heights
    if (sp.surface === 'antigravity') return null;

    return {
      y: TrackEnvironment.groundY(sp.position.y, edgeDist),
      edgeDist,
    };
  }

  private buildTrees(spline: TrackSpline, envType: string): void {
    const rng = mulberry32(42);

    const leafColors: Record<string, number> = {
      meadow: 0x2d8c3a, volcano: 0x2a1508, coastal: 0x36a35a,
      frozen: 0x88aacc, night: 0x1a2a1a,
    };
    const leafDarkColors: Record<string, number> = {
      meadow: 0x1b5c24, volcano: 0x1a0a04, coastal: 0x246838,
      frozen: 0x667788, night: 0x0e1a0e,
    };
    const leafColor = leafColors[envType] ?? 0x2d8c3a;
    const leafDark = leafDarkColors[envType] ?? 0x1b5c24;
    const trunkColor = envType === 'volcano' ? 0x1a0e08
      : envType === 'frozen' ? 0x556677
      : envType === 'night' ? 0x2a2a35
      : 0x8B5A2B;

    const dummy = new THREE.Object3D();

    // ── Palm trees for coastal ──
    if (envType === 'coastal') {
      const palmCount = 90;
      const frondsPerTree = 5;

      // Trunk — tall, thin, tapered, gray-brown with gentle curve
      const trunkBend = 1.2; // how far the top bows in local +X
      const palmTrunkGeo = new THREE.CylinderGeometry(0.10, 0.24, 7, 8, 12);
      {
        // Bend trunk: offset X based on height using a smooth power curve
        const tPos = palmTrunkGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < tPos.count; i++) {
          const y = tPos.getY(i);
          const t = (y + 3.5) / 7; // 0 at bottom, 1 at top
          tPos.setX(i, tPos.getX(i) + trunkBend * Math.pow(t, 2.2));
        }
        tPos.needsUpdate = true;
        palmTrunkGeo.computeVertexNormals();
      }
      const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.95 });
      const palmTrunkMesh = new THREE.InstancedMesh(palmTrunkGeo, palmTrunkMat, palmCount);
      palmTrunkMesh.castShadow = true;

      // Coconuts — 2 or 3 individual fruits per tree
      const maxCoconuts = 3;
      const coconutGeo = new THREE.SphereGeometry(0.40, 7, 5);
      const coconutMat = new THREE.MeshStandardMaterial({ color: 0x6b4c1e, roughness: 0.95 });
      const coconutMesh = new THREE.InstancedMesh(coconutGeo, coconutMat, palmCount * maxCoconuts);

      // Helper: bend a frond geometry so it curves downward naturally
      const bendFrond = (geo: THREE.BufferGeometry, length: number, curve: number) => {
        const pos = geo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const z = pos.getZ(i);
          const t = Math.max(0, z) / length; // 0 at base, 1 at tip
          pos.setY(i, pos.getY(i) - curve * t * t);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      };

      // Fronds — wide leaf shapes with natural downward curve
      const frondGeo = new THREE.ConeGeometry(0.65, 4.5, 4, 8);
      frondGeo.rotateX(Math.PI / 2);   // point along +Z
      frondGeo.translate(0, 0, 2.25);  // origin at base
      bendFrond(frondGeo, 4.5, 30);   // deep curve for heavy droop

      // Procedural leaf texture via canvas for realistic veining
      const leafCanvas = document.createElement('canvas');
      leafCanvas.width = 128;
      leafCanvas.height = 256;
      const ctx = leafCanvas.getContext('2d')!;
      // Base gradient — lighter at center, darker at edges
      const grad = ctx.createLinearGradient(0, 0, 128, 0);
      grad.addColorStop(0, '#276e30');
      grad.addColorStop(0.35, '#3aad4e');
      grad.addColorStop(0.5, '#48c25a');
      grad.addColorStop(0.65, '#3aad4e');
      grad.addColorStop(1, '#276e30');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 256);
      // Central vein (rachis)
      ctx.strokeStyle = '#2a6e1e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(64, 0);
      ctx.lineTo(64, 256);
      ctx.stroke();
      // Side veins (pinnae lines)
      ctx.strokeStyle = '#328a3a';
      ctx.lineWidth = 1;
      for (let v = 12; v < 256; v += 16) {
        ctx.beginPath();
        ctx.moveTo(64, v);
        ctx.lineTo(4, v + 20);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(64, v);
        ctx.lineTo(124, v + 20);
        ctx.stroke();
      }
      // Subtle noise for organic feel
      const imgData = ctx.getImageData(0, 0, 128, 256);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 18;
        imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + n));
        imgData.data[i + 1] = Math.min(255, Math.max(0, imgData.data[i + 1] + n));
        imgData.data[i + 2] = Math.min(255, Math.max(0, imgData.data[i + 2] + n));
      }
      ctx.putImageData(imgData, 0, 0);

      const leafTex = new THREE.CanvasTexture(leafCanvas);
      leafTex.wrapS = THREE.RepeatWrapping;
      leafTex.wrapT = THREE.RepeatWrapping;

      const frondMat = new THREE.MeshStandardMaterial({
        map: leafTex, color: 0x44aa55, roughness: 0.82, side: THREE.DoubleSide,
      });
      const frondMesh = new THREE.InstancedMesh(frondGeo, frondMat, palmCount * frondsPerTree);
      frondMesh.castShadow = true;
      frondMesh.receiveShadow = true;

      // Darker under-fronds for depth (also curved)
      const frondDarkGeo = new THREE.ConeGeometry(0.50, 3.8, 4, 8);
      frondDarkGeo.rotateX(Math.PI / 2);
      frondDarkGeo.translate(0, 0, 1.9);
      bendFrond(frondDarkGeo, 3.8, 4.8);
      const frondDarkMat = new THREE.MeshStandardMaterial({
        map: leafTex, color: 0x226630, roughness: 0.85, side: THREE.DoubleSide,
      });
      const frondDarkMesh = new THREE.InstancedMesh(frondDarkGeo, frondDarkMat, palmCount * frondsPerTree);
      frondDarkMesh.castShadow = true;

      // Place palms in orderly rows along both sides of the track
      const perSide = Math.floor(palmCount / 2);
      let palmPlaced = 0;
      for (let row = 0; row < 2; row++) {
        const side = row === 0 ? 1 : -1;
        for (let i = 0; i < perSide; i++) {
          // Even spacing along spline with slight jitter
          const t = (i / perSide + rng() * 0.004) % 1;
          const sp = spline.getPointAt(t);
          const edgeDist = 5 + rng() * 3;          // tight range for consistent row
          const dist = sp.width * 0.5 + edgeDist;
          const scale = 0.85 + rng() * 0.35;       // less size variation
          const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

          const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 3);
          if (!clearance) continue;
          pos.y = clearance.y;

          // Slight random lean (like reference photos)
          const leanX = (rng() - 0.5) * 0.18;
          const leanZ = (rng() - 0.5) * 0.18;
          const yRot = rng() * Math.PI * 2;
          const trunkH = 7 * scale;

          // Trunk
          dummy.position.copy(pos);
          dummy.position.y += trunkH * 0.5;
          dummy.scale.set(scale, scale, scale);
          dummy.rotation.set(leanX, yRot, leanZ);
          dummy.updateMatrix();
          palmTrunkMesh.setMatrixAt(palmPlaced, dummy.matrix);

          // Top position (accounting for lean + geometric trunk bend)
          const bendWorld = trunkBend * scale;
          const topX = pos.x + Math.sin(leanZ) * trunkH * 0.5 + Math.cos(yRot) * bendWorld;
          const topY = pos.y + trunkH * Math.cos(leanX);
          const topZ = pos.z - Math.sin(leanX) * trunkH * 0.5 - Math.sin(yRot) * bendWorld;

          // Coconuts — place 2 or 3 individual fruits clustered at trunk top
          const coconutCount = rng() > 0.6 ? 3 : 2;
          for (let c = 0; c < maxCoconuts; c++) {
            if (c < coconutCount) {
              const cAngle = (c / coconutCount) * Math.PI * 2 + rng() * 0.8;
              const cDist = 0.18 * scale;
              dummy.position.set(
                topX + Math.cos(cAngle) * cDist,
                topY - 0.25 * scale + rng() * 0.12 * scale,
                topZ + Math.sin(cAngle) * cDist,
              );
              const cScale = scale * (0.8 + rng() * 0.4);
              dummy.scale.set(cScale, cScale * 1.15, cScale);
              dummy.rotation.set(rng() * 0.3, rng() * Math.PI, 0);
              dummy.updateMatrix();
            } else {
              dummy.position.set(0, -1000, 0);
              dummy.scale.set(0, 0, 0);
              dummy.updateMatrix();
            }
            coconutMesh.setMatrixAt(palmPlaced * maxCoconuts + c, dummy.matrix);
          }

          // Fronds radiating from top — spread origins outward for airy look
          for (let f = 0; f < frondsPerTree; f++) {
            const angle = (f / frondsPerTree) * Math.PI * 2 + rng() * 0.5;
            const droop = 0.45 + rng() * 0.55;
            const frondScale = scale * (0.9 + rng() * 0.35);

            // Offset each frond's origin outward along its radial direction
            const spread = 0.35 * scale;
            const ox = topX + Math.sin(angle) * spread;
            const oz = topZ + Math.cos(angle) * spread;

            // Main frond
            dummy.position.set(ox, topY + 0.15 * scale, oz);
            dummy.rotation.order = 'YXZ';
            dummy.rotation.set(-droop, angle, 0);
            dummy.scale.set(frondScale * 0.55, frondScale * 0.16, frondScale * 1.1);
            dummy.updateMatrix();
            frondMesh.setMatrixAt(palmPlaced * frondsPerTree + f, dummy.matrix);

            // Dark under-frond (more drooped, offset down)
            dummy.position.set(ox, topY + 0.02 * scale, oz);
            dummy.rotation.set(-droop - 0.18, angle + 0.1, 0);
            dummy.scale.set(frondScale * 0.45, frondScale * 0.12, frondScale * 0.95);
            dummy.updateMatrix();
            frondDarkMesh.setMatrixAt(palmPlaced * frondsPerTree + f, dummy.matrix);
          }

          palmPlaced++;
        }
      }
      palmTrunkMesh.count = palmPlaced;
      coconutMesh.count = palmPlaced * maxCoconuts;
      frondMesh.count = palmPlaced * frondsPerTree;
      frondDarkMesh.count = palmPlaced * frondsPerTree;
      palmTrunkMesh.instanceMatrix.needsUpdate = true;
      coconutMesh.instanceMatrix.needsUpdate = true;
      frondMesh.instanceMatrix.needsUpdate = true;
      frondDarkMesh.instanceMatrix.needsUpdate = true;
      this.group.add(palmTrunkMesh);
      this.group.add(coconutMesh);
      this.group.add(frondMesh);
      this.group.add(frondDarkMesh);
    }

    // ── Conifer trees (stacked cones) — non-coastal ──
    if (envType !== 'coastal') {
    const coniferCount = 120;
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.28, 3.5, 8);
    const trunkMatOpts: THREE.MeshStandardMaterialParameters = { color: trunkColor, roughness: 0.92 };
    if (envType === 'volcano') {
      trunkMatOpts.emissive = 0x301005;
      trunkMatOpts.emissiveIntensity = 0.4;
    }
    const trunkMat = new THREE.MeshStandardMaterial(trunkMatOpts);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, coniferCount);
    trunkMesh.castShadow = true;

    const coneGeo = new THREE.ConeGeometry(1, 1.8, 8);
    const coneMatOpts: THREE.MeshStandardMaterialParameters = { color: leafColor, roughness: 0.85 };
    if (envType === 'volcano') {
      coneMatOpts.emissive = 0x6a1800;
      coneMatOpts.emissiveIntensity = 0.35;
    }
    const coneMat = new THREE.MeshStandardMaterial(coneMatOpts);
    const coneMesh = new THREE.InstancedMesh(coneGeo, coneMat, coniferCount * 4);
    coneMesh.castShadow = true;
    coneMesh.receiveShadow = true;

    const coneDarkGeo = new THREE.ConeGeometry(0.5, 1.2, 6);
    const coneDarkMatOpts: THREE.MeshStandardMaterialParameters = { color: leafDark, roughness: 0.9 };
    if (envType === 'volcano') {
      coneDarkMatOpts.emissive = 0x8a2000;
      coneDarkMatOpts.emissiveIntensity = 0.5;
    }
    const coneDarkMat = new THREE.MeshStandardMaterial(coneDarkMatOpts);
    const coneDarkMesh = new THREE.InstancedMesh(coneDarkGeo, coneDarkMat, coniferCount);

    let placed = 0;
    for (let attempt = 0; placed < coniferCount && attempt < coniferCount * 3; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const edgeDist = 4 + rng() * 30;
      const dist = sp.width * 0.5 + edgeDist;
      const scale = 0.5 + rng() * 1.1;
      const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

      // Check clearance from ALL track sections
      const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 3);
      if (!clearance) continue;
      // Skip placement on elevated sections (no terrain to stand on)
      if (envType === 'frozen' && clearance.y > 2) continue;
      pos.y = clearance.y;
      // Match the extra ground drop applied in buildGround for non-coastal stages
      if (envType !== 'coastal') {
        const dropT = Math.max(1 - clearance.edgeDist / 25, 0);
        pos.y -= 1.5 * dropT * dropT;
      }

      const i = placed;
      dummy.position.copy(pos);
      dummy.position.y += 1.75 * scale;
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);

      // 4 foliage layers
      for (let j = 0; j < 4; j++) {
        const ls = scale * (1.4 - j * 0.28);
        dummy.position.copy(pos);
        dummy.position.y += (2.8 + j * 1.1) * scale;
        dummy.scale.set(ls, scale * 0.85, ls);
        dummy.rotation.set(0, rng() * Math.PI, 0);
        dummy.updateMatrix();
        coneMesh.setMatrixAt(i * 4 + j, dummy.matrix);
      }

      dummy.position.copy(pos);
      dummy.position.y += 4.5 * scale;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      coneDarkMesh.setMatrixAt(i, dummy.matrix);

      // Store position for illumination (night env)
      if (envType === 'night') {
        this.treePositions.push({ x: pos.x, y: pos.y, z: pos.z, scale });
      }

      placed++;
    }
    trunkMesh.count = placed;
    coneMesh.count = placed * 4;
    coneDarkMesh.count = placed;
    trunkMesh.instanceMatrix.needsUpdate = true;
    coneMesh.instanceMatrix.needsUpdate = true;
    coneDarkMesh.instanceMatrix.needsUpdate = true;
    this.group.add(trunkMesh);
    this.group.add(coneMesh);
    this.group.add(coneDarkMesh);
    }

    // ── Deciduous trees (round canopy) — meadow, night only ──
    if (envType !== 'volcano' && envType !== 'frozen' && envType !== 'coastal') {
      const decidCount = 60;
      const dTrunkGeo = new THREE.CylinderGeometry(0.18, 0.35, 4.0, 8);
      const dTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.9 });
      const dTrunkMesh = new THREE.InstancedMesh(dTrunkGeo, dTrunkMat, decidCount);
      dTrunkMesh.castShadow = true;

      const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
      const canopyMat = new THREE.MeshStandardMaterial({ color: envType === 'coastal' ? 0x40aa55 : 0x35953e, roughness: 0.82 });
      const canopyMesh = new THREE.InstancedMesh(canopyGeo, canopyMat, decidCount * 3);
      canopyMesh.castShadow = true;
      canopyMesh.receiveShadow = true;

      let dPlaced = 0;
      for (let attempt = 0; dPlaced < decidCount && attempt < decidCount * 3; attempt++) {
        const t = rng();
        const sp = spline.getPointAt(t);
        const side = rng() > 0.5 ? 1 : -1;
        const edgeDist = 6 + rng() * 28;
        const dist = sp.width * 0.5 + edgeDist;
        const scale = 0.7 + rng() * 0.9;
        const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

        const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 3);
        if (!clearance) continue;
        pos.y = clearance.y;
        // Match the extra ground drop applied in buildGround for non-coastal stages
        if (envType !== 'coastal') {
          const dropT = Math.max(1 - clearance.edgeDist / 25, 0);
          pos.y -= 1.5 * dropT * dropT;
        }

        const i = dPlaced;
        dummy.position.copy(pos);
        dummy.position.y += 2.0 * scale;
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.updateMatrix();
        dTrunkMesh.setMatrixAt(i, dummy.matrix);

        // 3 overlapping canopy blobs
        for (let j = 0; j < 3; j++) {
          const cx = (rng() - 0.5) * 1.2 * scale;
          const cz = (rng() - 0.5) * 1.2 * scale;
          const cs = scale * (0.9 + rng() * 0.5);
          dummy.position.copy(pos);
          dummy.position.y += (4.0 + rng() * 0.8) * scale;
          dummy.position.x += cx;
          dummy.position.z += cz;
          dummy.scale.set(cs * 1.2, cs * 0.9, cs * 1.2);
          dummy.rotation.set(rng() * 0.3, rng() * Math.PI, rng() * 0.3);
          dummy.updateMatrix();
          canopyMesh.setMatrixAt(i * 3 + j, dummy.matrix);
        }
        dPlaced++;
      }
      dTrunkMesh.count = dPlaced;
      canopyMesh.count = dPlaced * 3;
      dTrunkMesh.instanceMatrix.needsUpdate = true;
      canopyMesh.instanceMatrix.needsUpdate = true;
      this.group.add(dTrunkMesh);
      this.group.add(canopyMesh);
    }

    // ── Bushes (low round shapes near trackside) ──
    const bushCount = 100;
    const bushGeo = new THREE.IcosahedronGeometry(1, 1);
    const bushMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(leafColor).multiplyScalar(0.85).getHex(),
      roughness: 0.88,
    });
    const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
    bushMesh.castShadow = true;
    bushMesh.receiveShadow = true;

    let bushPlaced = 0;
    for (let attempt = 0; bushPlaced < bushCount && attempt < bushCount * 3; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const edgeDist = 1.5 + rng() * 6;
      const dist = sp.width * 0.5 + edgeDist;
      const scale = 0.3 + rng() * 0.5;
      const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

      const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 1.5);
      if (!clearance) continue;
      pos.y = clearance.y;
      if (envType !== 'coastal') {
        const dropT = Math.max(1 - clearance.edgeDist / 25, 0);
        pos.y -= 1.5 * dropT * dropT;
      }

      dummy.position.copy(pos);
      dummy.position.y += scale * 0.4;
      dummy.scale.set(scale * 1.3, scale * 0.7, scale * 1.3);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.updateMatrix();
      bushMesh.setMatrixAt(bushPlaced, dummy.matrix);
      bushPlaced++;
    }
    bushMesh.count = bushPlaced;
    bushMesh.instanceMatrix.needsUpdate = true;
    this.group.add(bushMesh);
  }

  private buildRocks(spline: TrackSpline, envType: string): void {
    const rng = mulberry32(77);
    const colors: Record<string, number> = {
      meadow: 0x888880, volcano: 0x554433, coastal: 0xaa9977,
      frozen: 0x99aabb, night: 0x444455,
    };
    const colorsDark: Record<string, number> = {
      meadow: 0x666660, volcano: 0x3a2a1e, coastal: 0x887755,
      frozen: 0x778899, night: 0x333340,
    };

    // ── Large boulders ──
    const boulderCount = 30;
    const boulderGeo = new THREE.DodecahedronGeometry(1, 2);
    const bPos = boulderGeo.getAttribute('position');
    for (let i = 0; i < bPos.count; i++) {
      bPos.setX(i, bPos.getX(i) * (0.65 + Math.random() * 0.7));
      bPos.setY(i, bPos.getY(i) * (0.4 + Math.random() * 0.6));
      bPos.setZ(i, bPos.getZ(i) * (0.65 + Math.random() * 0.7));
    }
    boulderGeo.computeVertexNormals();
    const boulderMat = new THREE.MeshStandardMaterial({ color: colors[envType] ?? 0x888880, roughness: 0.95 });
    const boulderMesh = new THREE.InstancedMesh(boulderGeo, boulderMat, boulderCount);
    boulderMesh.castShadow = true;
    boulderMesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let bPlaced = 0;
    for (let attempt = 0; bPlaced < boulderCount && attempt < boulderCount * 3; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const edgeDist = 3 + rng() * 18;
      const dist = sp.width * 0.5 + edgeDist;
      const scale = 0.6 + rng() * 1.4;
      const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

      const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 2);
      if (!clearance) continue;
      if (envType === 'frozen' && clearance.y > 2) continue;

      let boulderY = clearance.y;
      if (envType !== 'coastal') {
        const dropT = Math.max(1 - clearance.edgeDist / 25, 0);
        boulderY -= 1.5 * dropT * dropT;
      }
      dummy.position.copy(pos);
      dummy.position.y = boulderY + scale * 0.2;
      dummy.scale.set(scale, scale * 0.55, scale);
      dummy.rotation.set(rng() * 0.3, rng() * Math.PI * 2, rng() * 0.3);
      dummy.updateMatrix();
      boulderMesh.setMatrixAt(bPlaced, dummy.matrix);
      bPlaced++;
    }
    boulderMesh.count = bPlaced;
    boulderMesh.instanceMatrix.needsUpdate = true;
    this.group.add(boulderMesh);

    // ── Small scattered pebbles ──
    const pebbleCount = 80;
    const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
    const pPos = pebbleGeo.getAttribute('position');
    for (let i = 0; i < pPos.count; i++) {
      pPos.setX(i, pPos.getX(i) * (0.6 + Math.random() * 0.8));
      pPos.setY(i, pPos.getY(i) * (0.3 + Math.random() * 0.4));
      pPos.setZ(i, pPos.getZ(i) * (0.6 + Math.random() * 0.8));
    }
    pebbleGeo.computeVertexNormals();
    const pebbleMat = new THREE.MeshStandardMaterial({ color: colorsDark[envType] ?? 0x666660, roughness: 0.98 });
    const pebbleMesh = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
    pebbleMesh.receiveShadow = true;

    let pPlaced = 0;
    for (let attempt = 0; pPlaced < pebbleCount && attempt < pebbleCount * 3; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const edgeDist = 1 + rng() * 8;
      const dist = sp.width * 0.5 + edgeDist;
      const scale = 0.1 + rng() * 0.3;
      const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

      const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 1);
      if (!clearance) continue;
      if (envType === 'frozen' && clearance.y > 2) continue;

      let pebbleY = clearance.y;
      if (envType !== 'coastal') {
        const dropT = Math.max(1 - clearance.edgeDist / 25, 0);
        pebbleY -= 1.5 * dropT * dropT;
      }
      dummy.position.copy(pos);
      dummy.position.y = pebbleY + scale * 0.15;
      dummy.scale.set(scale, scale * 0.5, scale);
      dummy.rotation.set(rng(), rng() * Math.PI * 2, rng());
      dummy.updateMatrix();
      pebbleMesh.setMatrixAt(pPlaced, dummy.matrix);
      pPlaced++;
    }
    pebbleMesh.count = pPlaced;
    pebbleMesh.instanceMatrix.needsUpdate = true;
    this.group.add(pebbleMesh);

    // ── Trackside signs (chevron markers at turns) ──
    const signCount = 24;
    const signGeo = new THREE.PlaneGeometry(0.8, 0.6);
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 64;
    signCanvas.height = 48;
    const sctx = signCanvas.getContext('2d')!;
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, 64, 48);
    // Red chevron arrow
    sctx.fillStyle = '#cc2200';
    sctx.beginPath();
    sctx.moveTo(8, 24);
    sctx.lineTo(32, 6);
    sctx.lineTo(56, 24);
    sctx.lineTo(50, 30);
    sctx.lineTo(32, 16);
    sctx.lineTo(14, 30);
    sctx.closePath();
    sctx.fill();
    sctx.beginPath();
    sctx.moveTo(8, 36);
    sctx.lineTo(32, 18);
    sctx.lineTo(56, 36);
    sctx.lineTo(50, 42);
    sctx.lineTo(32, 28);
    sctx.lineTo(14, 42);
    sctx.closePath();
    sctx.fill();
    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, side: THREE.DoubleSide, roughness: 0.5 });
    const signPostGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6);
    const signPostMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.4 });

    let signIdx = 0;
    for (let i = 0; i < signCount && signIdx < signCount; i++) {
      const t = i / signCount;
      const sp = spline.getPointAt(t);
      const sp2 = spline.getPointAt((t + 0.02) % 1);
      // Only place signs where track curves significantly
      const cross = sp.tangent.clone().cross(sp2.tangent);
      if (Math.abs(cross.y) < 0.015) continue;
      const side = cross.y > 0 ? 1 : -1;
      const hw = sp.width * 0.5 + 0.8;

      // Post
      const post = new THREE.Mesh(signPostGeo, signPostMat);
      const signPos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * hw));
      post.position.copy(signPos);
      post.position.y += 0.5;
      this.group.add(post);

      // Sign face
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.copy(signPos);
      sign.position.y += 1.1;
      sign.lookAt(sign.position.clone().add(sp.binormal.clone().multiplyScalar(-side)));
      if (side < 0) sign.rotateY(Math.PI);
      this.group.add(sign);
      signIdx++;
    }

    // ── Grass tufts (small vertical planes near track) ──
    if (envType !== 'volcano' && envType !== 'frozen') {
      const grassCount = 200;
      const grassGeo = new THREE.PlaneGeometry(0.3, 0.5);
      grassGeo.translate(0, 0.25, 0);
      const grassMat = new THREE.MeshStandardMaterial({
        color: envType === 'night' ? 0x1a2a15 : envType === 'coastal' ? 0x55aa55 : 0x44882a,
        roughness: 0.9,
        side: THREE.DoubleSide,
        alphaTest: 0.5,
      });
      const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);

      let gPlaced = 0;
      for (let attempt = 0; gPlaced < grassCount && attempt < grassCount * 3; attempt++) {
        const t = rng();
        const sp = spline.getPointAt(t);
        const side = rng() > 0.5 ? 1 : -1;
        const edgeDist = 0.5 + rng() * 4;
        const dist = sp.width * 0.5 + edgeDist;
        const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

        const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 0.5);
        if (!clearance) continue;

        dummy.position.copy(pos);
        dummy.position.y = clearance.y;
        dummy.scale.set(0.8 + rng() * 0.6, 0.5 + rng() * 1.0, 1);
        dummy.rotation.set(0, rng() * Math.PI, 0);
        dummy.updateMatrix();
        grassMesh.setMatrixAt(gPlaced, dummy.matrix);
        gPlaced++;
      }
      grassMesh.count = gPlaced;
      grassMesh.instanceMatrix.needsUpdate = true;
      this.group.add(grassMesh);
    }
  }

  private buildFlowers(spline: TrackSpline): void {
    const count = 200;
    const rng = mulberry32(123);
    const flowerColors = [0xff4488, 0xffaa22, 0xffff44, 0xaa44ff, 0x44aaff];

    const petalGeo = new THREE.SphereGeometry(0.15, 6, 6);
    petalGeo.scale(1, 0.4, 1);

    for (const fc of flowerColors) {
      const mat = new THREE.MeshStandardMaterial({ color: fc, roughness: 0.8 });
      const batchCount = Math.floor(count / flowerColors.length);
      const mesh = new THREE.InstancedMesh(petalGeo, mat, batchCount);

      const dummy = new THREE.Object3D();
      let fPlaced = 0;
      for (let attempt = 0; fPlaced < batchCount && attempt < batchCount * 3; attempt++) {
        const t = rng();
        const sp = spline.getPointAt(t);
        const side = rng() > 0.5 ? 1 : -1;
        const edgeDist = 1 + rng() * 8;
        const dist = sp.width * 0.5 + edgeDist;
        const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

        const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 1);
        if (!clearance) continue;

        dummy.position.copy(pos);
        dummy.position.y = clearance.y + 0.15;
        dummy.scale.setScalar(0.5 + rng() * 0.8);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(fPlaced, dummy.matrix);
        fPlaced++;
      }
      mesh.count = fPlaced;
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    }
  }

  private buildClouds(envType: string): void {
    const rng = mulberry32(200);
    const cloudCount = envType === 'volcano' ? 8 : envType === 'frozen' ? 20 : 15;

    // Cloud material — soft white, unlit
    const cloudMat = new THREE.MeshBasicMaterial({
      color: envType === 'volcano' ? 0xaa9999 : envType === 'frozen' ? 0xccddee : 0xffffff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      fog: false,
    });

    // Each cloud is a cluster of stretched spheres
    for (let i = 0; i < cloudCount; i++) {
      const cloudGroup = new THREE.Group();

      // Random position in the sky spread around the track area
      const x = (rng() - 0.5) * 600;
      const z = (rng() - 0.5) * 600;
      const y = 60 + rng() * 80;
      cloudGroup.position.set(x, y, z);

      // Each cloud = 4-8 overlapping ellipsoids
      const puffCount = 4 + Math.floor(rng() * 5);
      for (let p = 0; p < puffCount; p++) {
        const puffGeo = new THREE.SphereGeometry(1, 8, 6);
        const puff = new THREE.Mesh(puffGeo, cloudMat);

        // Random offset within cloud bounds
        puff.position.set(
          (rng() - 0.5) * 20,
          (rng() - 0.5) * 4,
          (rng() - 0.5) * 10,
        );

        // Flatten and stretch
        const sx = 4 + rng() * 8;
        const sy = 1.5 + rng() * 2;
        const sz = 3 + rng() * 5;
        puff.scale.set(sx, sy, sz);

        cloudGroup.add(puff);
      }

      // Random rotation for variety
      cloudGroup.rotation.y = rng() * Math.PI * 2;

      this.group.add(cloudGroup);
    }
  }

  private buildWater(): void {
    // All water/beach elements are on the +X side only
    const shoreX = 130;  // where the coastline begins (inland edge)

    // ── Beach strip — slopes from land down into the water ──
    const beachLen = 2400; // length along Z (coastline)
    const beachD = 100;    // depth from inland to waterline
    const beachGeo = new THREE.PlaneGeometry(beachD, beachLen, 20, 1);
    beachGeo.rotateX(-Math.PI / 2);

    // Slope: -X side (inland) is high, +X side (water) is low
    const bPos = beachGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < bPos.count; i++) {
      const x = bPos.getX(i);
      const t = (x - (-beachD / 2)) / beachD; // 0 = inland, 1 = waterline
      bPos.setY(i, 0.3 - t * 2.5);            // 0.3 → -2.2
    }
    bPos.needsUpdate = true;
    beachGeo.computeVertexNormals();

    // Sand texture with wet/dry gradient
    const sandCanvas = document.createElement('canvas');
    sandCanvas.width = 256;
    sandCanvas.height = 128;
    const sCtx = sandCanvas.getContext('2d')!;
    // Gradient left→right: dry inland → wet waterline
    const sGrad = sCtx.createLinearGradient(0, 0, 256, 0);
    sGrad.addColorStop(0, '#d4c494');    // dry warm sand
    sGrad.addColorStop(0.5, '#b8a870');  // mid
    sGrad.addColorStop(0.82, '#8a7a5a'); // wet sand
    sGrad.addColorStop(1, '#6a6050');    // waterline
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 256, 128);
    // Sand grain noise
    for (let i = 0; i < 5000; i++) {
      const bri = 0.88 + Math.random() * 0.24;
      sCtx.fillStyle = `rgba(${Math.floor(200 * bri)},${Math.floor(180 * bri)},${Math.floor(130 * bri)},0.3)`;
      sCtx.fillRect(Math.random() * 256, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    // Foam lines near waterline (right edge)
    sCtx.strokeStyle = 'rgba(255,255,255,0.4)';
    sCtx.lineWidth = 2;
    for (let line = 0; line < 3; line++) {
      const lx = 236 + line * 7;
      sCtx.beginPath();
      for (let y = 0; y < 128; y += 3) {
        sCtx.lineTo(lx + Math.sin(y * 0.15 + line * 2) * 3, y);
      }
      sCtx.stroke();
    }
    const sandTex = new THREE.CanvasTexture(sandCanvas);
    sandTex.wrapS = THREE.ClampToEdgeWrapping;
    sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.repeat.set(1, 6);

    const beachMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.95 });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.position.set(shoreX + beachD * 0.5, 0, 0);
    beach.receiveShadow = true;
    this.group.add(beach);

    // ── Shallow water — strip just past the beach ──
    const shallowW = 300;
    const shallowGeo = new THREE.PlaneGeometry(shallowW, beachLen);
    const shallowMat = new THREE.MeshStandardMaterial({
      color: 0x22bbcc,
      metalness: 0.3,
      roughness: 0.2,
      transparent: true,
      opacity: 0.65,
    });
    const shallow = new THREE.Mesh(shallowGeo, shallowMat);
    shallow.rotation.x = -Math.PI / 2;
    shallow.position.set(shoreX + beachD + shallowW * 0.5, -2, 0);
    this.group.add(shallow);

    // ── Deep ocean — extends far toward +X ──
    const oceanCanvas = document.createElement('canvas');
    oceanCanvas.width = 512;
    oceanCanvas.height = 64;
    const ctx = oceanCanvas.getContext('2d')!;
    // Gradient left→right: near shore → deep horizon
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#30c8d8');   // turquoise near shore
    grad.addColorStop(0.25, '#18a0c8');
    grad.addColorStop(0.6, '#1070b0');
    grad.addColorStop(1, '#0a4a8a');   // deep blue at horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 64);
    // Wave highlights
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let x = 8; x < 512; x += 14) {
      ctx.beginPath();
      for (let y = 0; y < 64; y += 3) {
        ctx.lineTo(x + Math.sin((x + y) * 0.2) * 2.5, y);
      }
      ctx.stroke();
    }
    const oceanTex = new THREE.CanvasTexture(oceanCanvas);
    oceanTex.wrapT = THREE.RepeatWrapping;
    oceanTex.repeat.set(1, 8);

    const oceanW = 5000;
    const oceanLen = 4000;
    const oceanGeo = new THREE.PlaneGeometry(oceanW, oceanLen, 1, 1);
    const oceanMat = new THREE.MeshStandardMaterial({
      map: oceanTex,
      color: 0x55ccee,
      metalness: 0.45,
      roughness: 0.12,
      transparent: true,
      opacity: 0.88,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(shoreX + beachD + shallowW + oceanW * 0.5, -1.8, 0);
    this.group.add(ocean);
  }

  private buildGround(spline: TrackSpline, envType: string): void {
    const colors: Record<string, number> = {
      meadow: 0x3a6b28,
      volcano: 0x4a3a28,
      coastal: 0xc2b280,
      frozen: 0xd0dde8,
      night: 0x141a10,
    };

    // Textured ground
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const baseColor = new THREE.Color(colors[envType] ?? 0x3a6b28);
    ctx.fillStyle = '#' + baseColor.getHexString();
    ctx.fillRect(0, 0, 256, 256);

    // Noise
    for (let i = 0; i < 3000; i++) {
      const variation = 0.85 + Math.random() * 0.3;
      const c = baseColor.clone().multiplyScalar(variation);
      ctx.fillStyle = '#' + c.getHexString();
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40);

    // Subdivided ground that follows track elevation
    const groundSize = 1600;
    const segs = 160;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, segs, segs);
    groundGeo.rotateX(-Math.PI / 2); // lay flat, Y is up

    // Adjust each vertex Y to match groundY() used for scenery placement
    const pos = groundGeo.getAttribute('position') as THREE.BufferAttribute;
    const probe = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      probe.set(vx, 0, vz);

      const closestT = spline.findClosestT(probe);
      const sp = spline.getPointAt(closestT);
      const hw = sp.width * 0.5;

      const dx = vx - sp.position.x;
      const dz = vz - sp.position.z;
      const xzDist = Math.sqrt(dx * dx + dz * dz);
      const edgeDist = Math.max(xzDist - hw, 0);

      let y = TrackEnvironment.groundY(sp.position.y, edgeDist);
      // For non-coastal stages, push ground further below the road surface
      // to prevent coarse grid interpolation from poking through on hilly tracks
      if (envType !== 'coastal') {
        const dropT = Math.max(1 - edgeDist / 25, 0);
        y -= 1.5 * dropT * dropT;
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 1.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  /** Frozen Peaks: snow mounds, ice crystals, frozen lake */
  private buildSnow(spline: TrackSpline): void {
    const rng = mulberry32(500);
    const dummy = new THREE.Object3D();

    // ── Snow mounds (white rounded shapes) ──
    const moundCount = 80;
    const moundGeo = new THREE.IcosahedronGeometry(1, 2);
    const moundMat = new THREE.MeshStandardMaterial({
      color: 0xe8eeff,
      roughness: 0.6,
      metalness: 0.1,
    });
    const moundMesh = new THREE.InstancedMesh(moundGeo, moundMat, moundCount);
    moundMesh.receiveShadow = true;

    let mPlaced = 0;
    for (let attempt = 0; mPlaced < moundCount && attempt < moundCount * 3; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const edgeDist = 2 + rng() * 12;
      const dist = sp.width * 0.5 + edgeDist;
      const scale = 0.4 + rng() * 1.2;
      const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

      const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 1.5);
      if (!clearance) continue;
      if (clearance.y > 2) continue; // skip elevated sections

      dummy.position.copy(pos);
      dummy.position.y = clearance.y + scale * 0.15;
      dummy.scale.set(scale * 1.5, scale * 0.4, scale * 1.5);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.updateMatrix();
      moundMesh.setMatrixAt(mPlaced, dummy.matrix);
      mPlaced++;
    }
    moundMesh.count = mPlaced;
    moundMesh.instanceMatrix.needsUpdate = true;
    this.group.add(moundMesh);

    // ── Ice crystals (tall pointed translucent shapes) ──
    const crystalCount = 40;
    const crystalGeo = new THREE.ConeGeometry(0.3, 2.0, 5);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xe8eeff,
      roughness: 0.6,
      metalness: 0.05,
    });
    const crystalMesh = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalCount);
    crystalMesh.castShadow = true;

    let cPlaced = 0;
    for (let attempt = 0; cPlaced < crystalCount && attempt < crystalCount * 3; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const edgeDist = 2 + rng() * 15;
      const dist = sp.width * 0.5 + edgeDist;
      const scale = 0.5 + rng() * 1.5;
      const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

      const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 2);
      if (!clearance) continue;
      if (clearance.y > 2) continue; // skip elevated sections

      dummy.position.copy(pos);
      dummy.position.y = clearance.y + scale;
      dummy.scale.set(scale, scale, scale);
      // Slight tilt
      dummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
      dummy.updateMatrix();
      crystalMesh.setMatrixAt(cPlaced, dummy.matrix);
      cPlaced++;
    }
    crystalMesh.count = cPlaced;
    crystalMesh.instanceMatrix.needsUpdate = true;
    this.group.add(crystalMesh);

    // ── Frozen lake ──
    const iceGeo = new THREE.PlaneGeometry(1600, 1600);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xbbddee,
      metalness: 0.5,
      roughness: 0.05,
      transparent: true,
      opacity: 0.4,
    });
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.rotation.x = -Math.PI / 2;
    ice.position.y = -1.5;
    ice.receiveShadow = true;
    this.group.add(ice);

    // ── Giant Iceberg at Hairpin 1 ──
    this.buildGiantIceberg(spline);
  }

  /** Build the massive iceberg cluster at the Hairpin 1 curve */
  private buildGiantIceberg(spline: TrackSpline): void {
    const icebergGroup = new THREE.Group();

    // Snow-white material (shared for all spires)
    const iceMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8eeff,
      roughness: 0.6,
      metalness: 0.05,
    });
    // Same snow-white for satellite spires
    const iceTranslucent = new THREE.MeshStandardMaterial({
      color: 0xe8eeff,
      roughness: 0.6,
      metalness: 0.05,
    });

    // Spire configs: [offsetX, offsetZ, baseRadius, height]
    const spires: [number, number, number, number][] = [
      [0, 0, 80, 140],        // Main spire
      [35, 20, 20, 48],       // NE satellite
      [20, -30, 20, 45],      // SE satellite
      [-15, 10, 18, 50],      // W satellite (near road)
    ];

    const icebergCenter = new THREE.Vector3(-205, -1.5, -130);

    // Pre-sample road points inside iceberg for face culling
    const roadSamples: { x: number; y: number; z: number; hw: number }[] = [];
    const carveScanSteps = 500;
    const carveMargin = 6; // clearance around road half-width
    for (let i = 0; i <= carveScanSteps; i++) {
      const t = i / carveScanSteps;
      const sp = spline.getPointAt(t);
      const dx = sp.position.x - icebergCenter.x;
      const dz = sp.position.z - icebergCenter.z;
      if (dx * dx + dz * dz < (100 * 100)) { // within iceberg influence range
        roadSamples.push({
          x: sp.position.x, y: sp.position.y, z: sp.position.z,
          hw: sp.width * 0.5 + carveMargin,
        });
      }
    }

    // Helper: check if a world-space point is inside the tunnel corridor
    const isInsideTunnel = (wx: number, wy: number, wz: number): boolean => {
      for (const rs of roadSamples) {
        const dx = wx - rs.x;
        const dz = wz - rs.z;
        const distXZ = Math.sqrt(dx * dx + dz * dz);
        const dy = wy - rs.y;
        // Inside tunnel corridor: within road width + margin in XZ, and between
        // well below road to 10m above road (max tunnel height + margin)
        // Use generous downward range to cull cone faces near the base that
        // would otherwise poke through the road from below
        if (distXZ < rs.hw && dy > -80 && dy < 10) return true;
      }
      return false;
    };

    for (let si = 0; si < spires.length; si++) {
      const [ox, oz, baseR, height] = spires[si];
      const spireRng = mulberry32(800 + si * 137);
      const spireWorldX = icebergCenter.x + ox;
      const spireWorldY = icebergCenter.y + height * 0.5;
      const spireWorldZ = icebergCenter.z + oz;

      // Main cone body with vertex distortion
      const coneGeo = new THREE.ConeGeometry(baseR, height, si === 0 ? 24 : 12, 8);
      const verts = coneGeo.getAttribute('position');
      for (let i = 0; i < verts.count; i++) {
        const y = verts.getY(i);
        const heightRatio = (y + height * 0.5) / height; // 0 at base, 1 at peak
        const noiseMag = baseR * 0.18 * (1 - heightRatio * 0.8);
        verts.setX(i, verts.getX(i) + (spireRng() - 0.5) * noiseMag);
        verts.setZ(i, verts.getZ(i) + (spireRng() - 0.5) * noiseMag);
        verts.setY(i, verts.getY(i) + (spireRng() - 0.5) * height * 0.03 * (1 - heightRatio));
      }

      // Remove faces that overlap with tunnel corridors
      const srcIndex = coneGeo.getIndex();
      if (srcIndex) {
        const newIndices: number[] = [];
        for (let fi = 0; fi < srcIndex.count; fi += 3) {
          const i0 = srcIndex.getX(fi);
          const i1 = srcIndex.getX(fi + 1);
          const i2 = srcIndex.getX(fi + 2);

          // Triangle center in world space
          const cx = spireWorldX + (verts.getX(i0) + verts.getX(i1) + verts.getX(i2)) / 3;
          const cy = spireWorldY + (verts.getY(i0) + verts.getY(i1) + verts.getY(i2)) / 3;
          const cz = spireWorldZ + (verts.getZ(i0) + verts.getZ(i1) + verts.getZ(i2)) / 3;

          // Also check all three vertices — remove face if ANY vertex is inside tunnel
          const centerInside = isInsideTunnel(cx, cy, cz);
          const v0Inside = isInsideTunnel(
            spireWorldX + verts.getX(i0), spireWorldY + verts.getY(i0), spireWorldZ + verts.getZ(i0));
          const v1Inside = isInsideTunnel(
            spireWorldX + verts.getX(i1), spireWorldY + verts.getY(i1), spireWorldZ + verts.getZ(i1));
          const v2Inside = isInsideTunnel(
            spireWorldX + verts.getX(i2), spireWorldY + verts.getY(i2), spireWorldZ + verts.getZ(i2));

          // Remove face if center or majority of vertices are inside tunnel
          const insideCount = (v0Inside ? 1 : 0) + (v1Inside ? 1 : 0) + (v2Inside ? 1 : 0);
          if (centerInside || insideCount >= 2) continue;

          newIndices.push(i0, i1, i2);
        }
        coneGeo.setIndex(newIndices);
      }
      coneGeo.computeVertexNormals();

      const spire = new THREE.Mesh(coneGeo, si === 0 ? iceMaterial : iceTranslucent);
      spire.position.set(
        icebergCenter.x + ox,
        icebergCenter.y + height * 0.5,
        icebergCenter.z + oz,
      );
      spire.castShadow = true;
      spire.receiveShadow = true;
      icebergGroup.add(spire);

      // Snow cap on main spire (white cone at the top 35%)
      if (si === 0) {
        const capHeight = height * 0.35;
        const capRadius = baseR * 0.4;
        const capGeo = new THREE.ConeGeometry(capRadius, capHeight, 24, 4);
        const capVerts = capGeo.getAttribute('position');
        for (let i = 0; i < capVerts.count; i++) {
          const noise = (spireRng() - 0.5) * capRadius * 0.15;
          capVerts.setX(i, capVerts.getX(i) + noise);
          capVerts.setZ(i, capVerts.getZ(i) + noise);
        }
        capGeo.computeVertexNormals();
        const capMat = new THREE.MeshStandardMaterial({
          color: 0xf0f4ff, roughness: 0.4, metalness: 0.05,
        });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.set(
          icebergCenter.x + ox,
          icebergCenter.y + height - capHeight * 0.5,
          icebergCenter.z + oz,
        );
        icebergGroup.add(cap);
      }
    }

    // ── Ice crystal ring around the base ──
    const crystalRingGeo = new THREE.ConeGeometry(2, 8, 5);
    const crystalRingMat = new THREE.MeshStandardMaterial({
      color: 0xe8eeff,
      roughness: 0.6,
      metalness: 0.05,
    });
    const crystalCount = 20;
    const crystalMesh = new THREE.InstancedMesh(crystalRingGeo, crystalRingMat, crystalCount);
    const cDummy = new THREE.Object3D();
    const crystalRng = mulberry32(850);

    let cPlaced = 0;
    for (let i = 0; i < crystalCount; i++) {
      const angle = (i / crystalCount) * Math.PI * 2 + (crystalRng() - 0.5) * 0.3;
      const dist = 75 + crystalRng() * 20;
      const scale = 1 + crystalRng() * 2.5;

      const cx = icebergCenter.x + Math.cos(angle) * dist;
      const cy = icebergCenter.y + scale * 4;
      const cz = icebergCenter.z + Math.sin(angle) * dist;

      // Skip crystals that overlap the road corridor
      if (isInsideTunnel(cx, cy, cz)) continue;

      cDummy.position.set(cx, cy, cz);
      cDummy.scale.set(scale, scale, scale);
      cDummy.rotation.set(
        (crystalRng() - 0.5) * 0.4,
        crystalRng() * Math.PI * 2,
        (crystalRng() - 0.5) * 0.4,
      );
      cDummy.updateMatrix();
      crystalMesh.setMatrixAt(cPlaced, cDummy.matrix);
      cPlaced++;
    }
    crystalMesh.count = cPlaced;
    crystalMesh.instanceMatrix.needsUpdate = true;
    icebergGroup.add(crystalMesh);

    // ── Frozen mist ring at the base ──
    const mistGeo = new THREE.CylinderGeometry(90, 95, 10, 32, 1, true);
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0xccddff,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mist = new THREE.Mesh(mistGeo, mistMat);
    mist.position.set(icebergCenter.x, icebergCenter.y + 5, icebergCenter.z);
    icebergGroup.add(mist);

    // ── Ambient glow around the base ──
    const glowGeo = new THREE.CylinderGeometry(100, 110, 20, 32, 1, true);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x88bbee,
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(icebergCenter.x, icebergCenter.y + 10, icebergCenter.z);
    icebergGroup.add(glow);

    this.group.add(icebergGroup);

    // ── Ice tunnels where road passes through the iceberg ──
    this.buildIcebergTunnels(spline, icebergCenter, 80);
  }

  /** Build ice tunnel arches where road passes through the iceberg volume */
  private buildIcebergTunnels(spline: TrackSpline, center: THREE.Vector3, radius: number): void {
    // Scan the spline to find t-ranges inside the iceberg (XZ distance check)
    const scanSteps = 2000;
    const margin = 5; // extra margin so tunnel extends slightly beyond iceberg surface
    const effectiveR = radius + margin;
    const effectiveRSq = effectiveR * effectiveR;

    // Find contiguous ranges where road is inside the iceberg
    const insideRanges: { start: number; end: number }[] = [];
    let rangeStart = -1;

    for (let i = 0; i <= scanSteps; i++) {
      const t = i / scanSteps;
      const sp = spline.getPointAt(t);
      const dx = sp.position.x - center.x;
      const dz = sp.position.z - center.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < effectiveRSq) {
        if (rangeStart < 0) rangeStart = t;
      } else {
        if (rangeStart >= 0) {
          insideRanges.push({ start: rangeStart, end: (i - 1) / scanSteps });
          rangeStart = -1;
        }
      }
    }
    if (rangeStart >= 0) {
      insideRanges.push({ start: rangeStart, end: 1.0 });
    }

    if (insideRanges.length === 0) return;

    // Tunnel materials
    const tunnelWallMat = new THREE.MeshStandardMaterial({
      color: 0xe8eeff,
      roughness: 0.6,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const tunnelPortalMat = new THREE.MeshStandardMaterial({
      color: 0xf0f4ff,
      roughness: 0.5,
      metalness: 0.05,
    });

    // Pre-sample all road points inside iceberg for adaptive height calculation
    const allIcebergRoadPts: { t: number; x: number; y: number; z: number }[] = [];
    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000;
      const sp = spline.getPointAt(t);
      const dx = sp.position.x - center.x;
      const dz = sp.position.z - center.z;
      if (dx * dx + dz * dz < effectiveRSq) {
        allIcebergRoadPts.push({ t, x: sp.position.x, y: sp.position.y, z: sp.position.z });
      }
    }

    // Compute adaptive tunnel height at a given t: limited by nearest OTHER road section
    const maxTunnelH = 8;
    const minTunnelH = 4;
    const adaptiveTunnelHeight = (t: number, pos: THREE.Vector3): number => {
      let minVerticalGap = Infinity;
      for (const rp of allIcebergRoadPts) {
        // Skip points that are part of the same road section (close in t)
        const tDist = Math.min(Math.abs(rp.t - t), 1 - Math.abs(rp.t - t));
        if (tDist < 0.03) continue; // same section
        const dx = rp.x - pos.x;
        const dz = rp.z - pos.z;
        const xzDist = Math.sqrt(dx * dx + dz * dz);
        if (xzDist < 25) { // close enough horizontally to matter
          const vertGap = Math.abs(rp.y - pos.y);
          if (vertGap < minVerticalGap) minVerticalGap = vertGap;
        }
      }
      // Cap tunnel height to half the vertical gap (leave room for both tunnels)
      if (minVerticalGap < Infinity) {
        return Math.max(minTunnelH, Math.min(maxTunnelH, (minVerticalGap - 2) * 0.45));
      }
      return maxTunnelH;
    };

    for (const range of insideRanges) {
      // Sample points along this range to build tunnel geometry
      const segCount = Math.max(8, Math.round((range.end - range.start) * 600));
      const archSegments = 12; // half-circle segments for arch cross-section

      // Build tunnel as a series of arch rings connected into a mesh
      const vertices: number[] = [];
      const indices: number[] = [];
      const segHeights: number[] = []; // store per-segment tunnel height for icicles/portals

      for (let si = 0; si <= segCount; si++) {
        const t = range.start + (si / segCount) * (range.end - range.start);
        const sp = spline.getPointAt(t);
        const halfW = sp.width * 0.55; // slightly wider than road
        const tunnelHeight = adaptiveTunnelHeight(t, sp.position);
        segHeights.push(tunnelHeight);

        // Create arch cross-section (half circle from left to right)
        for (let ai = 0; ai <= archSegments; ai++) {
          const angle = (ai / archSegments) * Math.PI; // 0 to PI (right to left over top)
          const localX = Math.cos(angle) * halfW;
          const localY = Math.sin(angle) * tunnelHeight;

          // Transform to world space using spline frame
          const worldPos = sp.position.clone()
            .add(sp.binormal.clone().multiplyScalar(localX))
            .add(sp.normal.clone().multiplyScalar(localY));

          vertices.push(worldPos.x, worldPos.y, worldPos.z);
        }

        // Connect to previous ring with triangles
        if (si > 0) {
          const ringVerts = archSegments + 1;
          const prevRing = (si - 1) * ringVerts;
          const currRing = si * ringVerts;
          for (let ai = 0; ai < archSegments; ai++) {
            const p0 = prevRing + ai;
            const p1 = prevRing + ai + 1;
            const c0 = currRing + ai;
            const c1 = currRing + ai + 1;
            indices.push(p0, c0, p1);
            indices.push(p1, c0, c1);
          }
        }
      }

      const tunnelGeo = new THREE.BufferGeometry();
      tunnelGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      tunnelGeo.setIndex(indices);
      tunnelGeo.computeVertexNormals();

      const tunnel = new THREE.Mesh(tunnelGeo, tunnelWallMat);
      tunnel.castShadow = true;
      tunnel.receiveShadow = true;
      this.group.add(tunnel);

      // ── Portal arches at entrance and exit ──
      const portalEntries: [number, number][] = [
        [range.start, segHeights[0]],
        [range.end, segHeights[segHeights.length - 1]],
      ];
      for (const [portalT, portalH] of portalEntries) {
        const sp = spline.getPointAt(portalT);
        const halfW = sp.width * 0.6;

        // Build portal arch as a tube following a half-circle path
        const archCurvePoints: THREE.Vector3[] = [];
        for (let i = 0; i <= 20; i++) {
          const angle = (i / 20) * Math.PI;
          const localX = Math.cos(angle) * halfW;
          const localY = Math.sin(angle) * (portalH + 1);
          const worldPos = sp.position.clone()
            .add(sp.binormal.clone().multiplyScalar(localX))
            .add(sp.normal.clone().multiplyScalar(localY));
          archCurvePoints.push(worldPos);
        }

        const archCurve = new THREE.CatmullRomCurve3(archCurvePoints);
        const portalGeo = new THREE.TubeGeometry(archCurve, 20, 0.6, 8, false);
        const portal = new THREE.Mesh(portalGeo, tunnelPortalMat);
        portal.castShadow = true;
        this.group.add(portal);
      }

      // ── Icicles hanging inside the tunnel ──
      const icicleCount = Math.round(segCount * 1.5);
      const icicleGeo = new THREE.ConeGeometry(0.15, 1.5, 5);
      const icicleMat = new THREE.MeshStandardMaterial({
        color: 0xe8eeff,
        roughness: 0.6,
        metalness: 0.05,
      });
      const icicleMesh = new THREE.InstancedMesh(icicleGeo, icicleMat, icicleCount);
      const icicleDummy = new THREE.Object3D();
      const icicleRng = mulberry32(1200 + Math.round(range.start * 10000));

      for (let i = 0; i < icicleCount; i++) {
        const frac = icicleRng();
        const localT = range.start + frac * (range.end - range.start);
        const sp = spline.getPointAt(localT);
        const halfW = sp.width * 0.5;
        // Interpolate tunnel height for this icicle position
        const segIdx = Math.min(Math.floor(frac * segCount), segCount - 1);
        const localTunnelH = segHeights[segIdx];

        // Random position along the arch ceiling (angle 30°-150° to stay on top)
        const angle = (0.17 + icicleRng() * 0.66) * Math.PI;
        const localX = Math.cos(angle) * halfW;
        const localY = Math.sin(angle) * localTunnelH;

        const worldPos = sp.position.clone()
          .add(sp.binormal.clone().multiplyScalar(localX))
          .add(sp.normal.clone().multiplyScalar(localY));

        const scale = 0.5 + icicleRng() * 1.5;
        icicleDummy.position.copy(worldPos);
        icicleDummy.scale.set(scale, scale, scale);
        // Point downward (cone default points up, rotate 180°)
        icicleDummy.rotation.set(Math.PI, icicleRng() * Math.PI * 2, 0);
        icicleDummy.updateMatrix();
        icicleMesh.setMatrixAt(i, icicleDummy.matrix);
      }
      icicleMesh.instanceMatrix.needsUpdate = true;
      this.group.add(icicleMesh);
    }
  }

  /** Starlight Highway: rainbow light posts, neon arches, massive floating orbs, rainbow edge strips, light pillars */
  private buildNightExtras(spline: TrackSpline): void {
    const rng = mulberry32(600);
    const dummy = new THREE.Object3D();

    // ── Rainbow palette for cycling ──
    const rainbowPalette = [
      0xff3333, 0xff8800, 0xffee00, 0x33ff55, 0x3399ff, 0x6633ff, 0xff33cc,
    ];
    const hslColor = (hue: number) => new THREE.Color().setHSL(hue % 1, 1.0, 0.55);

    // ── Floating rainbow orbs along the road (no poles, bobbing animation) ──
    const orbCount = Math.floor(spline.sampleCount * 0.3);
    const totalOrbs = orbCount * 2; // both sides

    // Large orbs (bigger, brighter)
    const orbGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const orbMeshes: THREE.InstancedMesh[] = [];
    for (const rc of rainbowPalette) {
      const orbMat = new THREE.MeshStandardMaterial({
        color: rc, emissive: rc, emissiveIntensity: 4.5,
        transparent: true, opacity: 0.92,
      });
      orbMeshes.push(new THREE.InstancedMesh(orbGeo, orbMat, totalOrbs));
    }
    // Orb glow halos
    const orbGlowGeo = new THREE.SphereGeometry(1.2, 8, 8);
    const orbGlowMeshes: THREE.InstancedMesh[] = [];
    for (const rc of rainbowPalette) {
      const mat = new THREE.MeshBasicMaterial({
        color: rc, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      orbGlowMeshes.push(new THREE.InstancedMesh(orbGlowGeo, mat, totalOrbs));
    }
    // Small companion orbs (brighter)
    const smallOrbGeo = new THREE.SphereGeometry(0.22, 8, 8);
    const smallOrbMeshes: THREE.InstancedMesh[] = [];
    for (const rc of rainbowPalette) {
      const mat = new THREE.MeshStandardMaterial({
        color: rc, emissive: rc, emissiveIntensity: 3.5,
        transparent: true, opacity: 0.85,
      });
      smallOrbMeshes.push(new THREE.InstancedMesh(smallOrbGeo, mat, totalOrbs));
    }

    // Store base positions + per-orb phase for animation
    const orbBasePositions: { x: number; y: number; z: number; phase: number }[] = [];
    const smallOrbBasePositions: { x: number; y: number; z: number; phase: number }[] = [];

    let orbIdx = 0;
    for (let i = 0; i < orbCount; i++) {
      const t = i / orbCount;
      const sp = spline.getPointAt(t);

      const hw = sp.width * 0.5 + 0.5;

      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * hw));
        const phase = t * Math.PI * 6 + s * Math.PI; // offset phase by side

        // Large orb — floating at ~2.5m height
        const colorIdx = orbIdx % rainbowPalette.length;
        const baseY = pos.y + 2.5;
        dummy.position.set(pos.x, baseY, pos.z);
        dummy.scale.setScalar(1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        orbMeshes[colorIdx].setMatrixAt(orbIdx, dummy.matrix);
        orbGlowMeshes[colorIdx].setMatrixAt(orbIdx, dummy.matrix);
        orbBasePositions.push({ x: pos.x, y: baseY, z: pos.z, phase });

        // Small companion orb — floating lower, different phase
        const midColorIdx = (orbIdx + 3) % rainbowPalette.length;
        const smallBaseY = pos.y + 1.3;
        dummy.position.set(pos.x, smallBaseY, pos.z);
        dummy.updateMatrix();
        smallOrbMeshes[midColorIdx].setMatrixAt(orbIdx, dummy.matrix);
        smallOrbBasePositions.push({ x: pos.x, y: smallBaseY, z: pos.z, phase: phase + Math.PI * 0.5 });

        orbIdx++;
      }
    }

    for (const om of orbMeshes) { om.count = orbIdx; om.instanceMatrix.needsUpdate = true; this.group.add(om); }
    for (const gm of orbGlowMeshes) { gm.count = orbIdx; gm.instanceMatrix.needsUpdate = true; this.group.add(gm); }
    for (const om of smallOrbMeshes) { om.count = orbIdx; om.instanceMatrix.needsUpdate = true; this.group.add(om); }

    // ── Bobbing animation via onBeforeRender ──
    const animDummy = new THREE.Object3D();
    const allOrbMeshes = [...orbMeshes, ...orbGlowMeshes, ...smallOrbMeshes];
    // Pick one mesh to drive the update (all share the same index count)
    const driverMesh = orbMeshes[0];
    driverMesh.onBeforeRender = () => {
      const time = performance.now() * 0.001;
      for (let i = 0; i < orbIdx; i++) {
        const bp = orbBasePositions[i];
        // Vertical bob + slight horizontal sway
        const bobY = Math.sin(time * 1.2 + bp.phase) * 0.5;
        const swayX = Math.sin(time * 0.7 + bp.phase * 1.3) * 0.2;
        const swayZ = Math.cos(time * 0.9 + bp.phase * 0.8) * 0.2;
        animDummy.position.set(bp.x + swayX, bp.y + bobY, bp.z + swayZ);
        animDummy.scale.setScalar(1);
        animDummy.rotation.set(0, 0, 0);
        animDummy.updateMatrix();
        for (const om of orbMeshes) {
          om.setMatrixAt(i, animDummy.matrix);
        }
        for (const gm of orbGlowMeshes) {
          gm.setMatrixAt(i, animDummy.matrix);
        }

        // Small orbs: faster bob, wider sway
        const sbp = smallOrbBasePositions[i];
        const sBobY = Math.sin(time * 1.8 + sbp.phase) * 0.35;
        const sSwayX = Math.sin(time * 1.1 + sbp.phase * 1.5) * 0.25;
        const sSwayZ = Math.cos(time * 1.3 + sbp.phase * 0.9) * 0.25;
        animDummy.position.set(sbp.x + sSwayX, sbp.y + sBobY, sbp.z + sSwayZ);
        animDummy.updateMatrix();
        for (const om of smallOrbMeshes) {
          om.setMatrixAt(i, animDummy.matrix);
        }
      }
      for (const om of allOrbMeshes) {
        om.instanceMatrix.needsUpdate = true;
      }
    };

    // ── Neon arches over the road ──
    const archCount = 18;
    const archTubeRadius = 0.12;
    for (let i = 0; i < archCount; i++) {
      const t = i / archCount;
      const sp = spline.getPointAt(t);

      const hw = sp.width * 0.5 + 0.3;
      const archColor = rainbowPalette[i % rainbowPalette.length];
      const archColor2 = rainbowPalette[(i + 3) % rainbowPalette.length];

      // Create arch as a half-torus
      const archCurve = new THREE.CatmullRomCurve3([
        sp.position.clone().add(sp.binormal.clone().multiplyScalar(-hw)).add(sp.normal.clone().multiplyScalar(0)),
        sp.position.clone().add(sp.binormal.clone().multiplyScalar(-hw * 0.6)).add(sp.normal.clone().multiplyScalar(5.0)),
        sp.position.clone().add(sp.normal.clone().multiplyScalar(6.5)),
        sp.position.clone().add(sp.binormal.clone().multiplyScalar(hw * 0.6)).add(sp.normal.clone().multiplyScalar(5.0)),
        sp.position.clone().add(sp.binormal.clone().multiplyScalar(hw)).add(sp.normal.clone().multiplyScalar(0)),
      ]);
      // Core arch
      const archGeo = new THREE.TubeGeometry(archCurve, 24, archTubeRadius, 8, false);
      const archMat = new THREE.MeshStandardMaterial({
        color: archColor, emissive: archColor, emissiveIntensity: 5.0,
        transparent: true, opacity: 0.9,
      });
      this.group.add(new THREE.Mesh(archGeo, archMat));

      // Inner glow tube
      const glowGeo = new THREE.TubeGeometry(archCurve, 24, archTubeRadius * 4, 6, false);
      const glowMat = new THREE.MeshBasicMaterial({
        color: archColor, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.group.add(new THREE.Mesh(glowGeo, glowMat));

      // Wide outer halo
      const haloGeo = new THREE.TubeGeometry(archCurve, 24, archTubeRadius * 10, 6, false);
      const haloMat = new THREE.MeshBasicMaterial({
        color: archColor2, transparent: true, opacity: 0.06,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      this.group.add(new THREE.Mesh(haloGeo, haloMat));
    }

    // ── Floating orbs (dense, bright, varied heights) ──
    const floatCount = 350;
    const floatGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const floatGlowGeo = new THREE.SphereGeometry(0.9, 6, 6);
    const floatHueCount = 14;
    for (let ci = 0; ci < floatHueCount; ci++) {
      const hue = ci / floatHueCount;
      const fc = hslColor(hue);
      const mat = new THREE.MeshStandardMaterial({
        color: fc, emissive: fc, emissiveIntensity: 4.0,
        transparent: true, opacity: 0.85,
      });
      const glowMat = new THREE.MeshBasicMaterial({
        color: fc, transparent: true, opacity: 0.08,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const batchSize = Math.floor(floatCount / floatHueCount);
      const mesh = new THREE.InstancedMesh(floatGeo, mat, batchSize);
      const glowMesh = new THREE.InstancedMesh(floatGlowGeo, glowMat, batchSize);

      let fPlaced = 0;
      for (let attempt = 0; fPlaced < batchSize && attempt < batchSize * 4; attempt++) {
        const t = rng();
        const sp = spline.getPointAt(t);
        const side = rng() > 0.5 ? 1 : -1;
        const edgeDist = 2 + rng() * 25;
        const dist = sp.width * 0.5 + edgeDist;
        const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

        const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 2);
        if (!clearance) continue;

        dummy.position.copy(pos);
        dummy.position.y = clearance.y + 1 + rng() * 12;
        dummy.scale.setScalar(0.5 + rng() * 1.5);
        dummy.updateMatrix();
        mesh.setMatrixAt(fPlaced, dummy.matrix);
        glowMesh.setMatrixAt(fPlaced, dummy.matrix);
        fPlaced++;
      }
      mesh.count = fPlaced;
      glowMesh.count = fPlaced;
      mesh.instanceMatrix.needsUpdate = true;
      glowMesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
      this.group.add(glowMesh);
    }

    // ── Rainbow neon edge strips (multi-color, denser, wider) ──
    const stripGeo = new THREE.PlaneGeometry(0.8, 4.5);
    const stripCount = Math.floor(spline.sampleCount * 0.2);
    for (let ci = 0; ci < rainbowPalette.length; ci++) {
      const sc = rainbowPalette[ci];
      const stripMat = new THREE.MeshStandardMaterial({
        color: sc, emissive: sc, emissiveIntensity: 3.5,
        side: THREE.DoubleSide, transparent: true, opacity: 0.7,
      });
      const perColor = Math.floor((stripCount * 2) / rainbowPalette.length);
      const stripMesh = new THREE.InstancedMesh(stripGeo, stripMat, perColor);

      let sIdx = 0;
      for (let i = ci; i < stripCount && sIdx < perColor; i += rainbowPalette.length) {
        const t = i / stripCount;
        const sp = spline.getPointAt(t);
  
        const hw = sp.width * 0.5 + 0.1;

        for (let s = 0; s < 2; s++) {
          if (sIdx >= perColor) break;
          const side = s === 0 ? -1 : 1;
          const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * hw));
          dummy.position.copy(pos);
          dummy.position.y += 0.02;
          dummy.quaternion.identity();
          const up = new THREE.Vector3(0, 1, 0);
          dummy.quaternion.setFromUnitVectors(up, sp.normal);
          dummy.updateMatrix();
          stripMesh.setMatrixAt(sIdx, dummy.matrix);
          sIdx++;
        }
      }
      stripMesh.count = sIdx;
      stripMesh.instanceMatrix.needsUpdate = true;
      this.group.add(stripMesh);
    }

    // ── Light pillars (vertical beams of light at road edges) ──
    const pillarCount = 30;
    const pillarHeight = 14;
    const pillarGeo = new THREE.CylinderGeometry(0.05, 0.05, pillarHeight, 6);
    for (let i = 0; i < pillarCount; i++) {
      const t = i / pillarCount;
      const sp = spline.getPointAt(t);

      const hw = sp.width * 0.5 + 0.3;
      const pillarColor = hslColor(t);

      for (let s = 0; s < 2; s++) {
        const side = s === 0 ? -1 : 1;
        const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * hw));

        // Core beam
        const coreMat = new THREE.MeshStandardMaterial({
          color: pillarColor, emissive: pillarColor, emissiveIntensity: 6.0,
          transparent: true, opacity: 0.8,
        });
        const core = new THREE.Mesh(pillarGeo, coreMat);
        core.position.copy(pos);
        core.position.y += pillarHeight * 0.5;
        this.group.add(core);

        // Inner glow halo
        const haloGeo1 = new THREE.CylinderGeometry(0.4, 0.4, pillarHeight, 6);
        const haloMat1 = new THREE.MeshBasicMaterial({
          color: pillarColor, transparent: true, opacity: 0.12,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const halo1 = new THREE.Mesh(haloGeo1, haloMat1);
        halo1.position.copy(core.position);
        this.group.add(halo1);

        // Wide outer halo
        const haloGeo2 = new THREE.CylinderGeometry(1.0, 1.0, pillarHeight, 6);
        const haloMat2 = new THREE.MeshBasicMaterial({
          color: pillarColor, transparent: true, opacity: 0.04,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const halo2 = new THREE.Mesh(haloGeo2, haloMat2);
        halo2.position.copy(core.position);
        this.group.add(halo2);
      }
    }

    // ── Tree illumination — tiny colorful lights wrapped around conifers ──
    const illuColors = [0xff2222, 0x22ff44, 0x4488ff, 0xffdd00, 0xff44cc, 0x44ffff, 0xff8800];
    const illuLightGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const illuGlowGeo = new THREE.SphereGeometry(0.25, 6, 6);

    // Pre-create materials for each color
    const illuLightMats = illuColors.map(c =>
      new THREE.MeshStandardMaterial({
        color: c, emissive: c, emissiveIntensity: 5.0,
        transparent: true, opacity: 0.95,
      }),
    );
    const illuGlowMats = illuColors.map(c =>
      new THREE.MeshBasicMaterial({
        color: c, transparent: true, opacity: 0.15,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );

    // Per-color instanced meshes
    const lightsPerTree = 18;
    const maxLights = this.treePositions.length * lightsPerTree;
    const illuLightMeshes = illuLightMats.map(mat =>
      new THREE.InstancedMesh(illuLightGeo, mat, maxLights),
    );
    const illuGlowMeshes = illuGlowMats.map(mat =>
      new THREE.InstancedMesh(illuGlowGeo, mat, maxLights),
    );

    const illuDummy = new THREE.Object3D();
    const illuCounters = new Array(illuColors.length).fill(0);

    for (const tree of this.treePositions) {
      const s = tree.scale;
      // Spiral lights from bottom foliage to top
      for (let j = 0; j < lightsPerTree; j++) {
        const frac = j / lightsPerTree; // 0 at bottom, 1 at top
        // Height along the tree canopy (foliage starts ~2.8*s, ends ~6.2*s)
        const h = tree.y + (2.5 + frac * 3.8) * s;
        // Cone radius narrows toward top
        const coneR = s * (1.3 - frac * 0.9) * (0.8 + rng() * 0.4);
        // Spiral angle
        const angle = frac * Math.PI * 6 + rng() * 0.8;
        const lx = tree.x + Math.cos(angle) * coneR;
        const lz = tree.z + Math.sin(angle) * coneR;

        const colorIdx = Math.floor(rng() * illuColors.length);

        illuDummy.position.set(lx, h, lz);
        illuDummy.scale.setScalar(0.8 + rng() * 0.5);
        illuDummy.updateMatrix();

        const ci = illuCounters[colorIdx];
        if (ci < maxLights) {
          illuLightMeshes[colorIdx].setMatrixAt(ci, illuDummy.matrix);
          illuGlowMeshes[colorIdx].setMatrixAt(ci, illuDummy.matrix);
          illuCounters[colorIdx] = ci + 1;
        }
      }
    }

    for (let c = 0; c < illuColors.length; c++) {
      illuLightMeshes[c].count = illuCounters[c];
      illuGlowMeshes[c].count = illuCounters[c];
      illuLightMeshes[c].instanceMatrix.needsUpdate = true;
      illuGlowMeshes[c].instanceMatrix.needsUpdate = true;
      this.group.add(illuLightMeshes[c]);
      this.group.add(illuGlowMeshes[c]);
    }

    // ── Dark ground with slight blue tint ──
    // (buildGround already handles this via the 'night' color)
  }

  /** Volcano Pass: lava pools, volcanic spires, fumaroles, lava lake */
  private buildVolcano(spline: TrackSpline): void {
    const rng = mulberry32(700);
    const dummy = new THREE.Object3D();

    // ── Lava pools (complex irregular shapes from overlapping blobs) ──
    const lavaPoolShader = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.1;
            a *= 0.45;
          }
          return v;
        }

        void main() {
          float dist = length(vUv - 0.5) * 2.0;
          vec2 uv = vUv * 4.0;

          // Warped flowing noise for complex lava pattern
          float warp = fbm(uv + uTime * 0.15);
          float n1 = fbm(uv + vec2(warp * 1.5, uTime * 0.1));
          float n2 = fbm(uv * 1.8 - vec2(uTime * 0.08, warp));
          float pattern = n1 * 0.6 + n2 * 0.4;

          // Veins of bright lava
          float veins = smoothstep(0.38, 0.42, pattern) - smoothstep(0.48, 0.55, pattern);
          veins += smoothstep(0.62, 0.66, pattern) - smoothstep(0.72, 0.78, pattern);

          float ripple = sin(dist * 6.0 - uTime * 1.8) * 0.1;
          float pulse = 0.75 + 0.25 * sin(uTime * 1.2 + dist * 3.0);

          vec3 bright = vec3(1.0, 0.75, 0.2);
          vec3 hot    = vec3(1.0, 0.4, 0.06);
          vec3 warm   = vec3(0.7, 0.12, 0.02);
          vec3 crust  = vec3(0.2, 0.06, 0.02);

          float crustMask = smoothstep(0.3, 0.6, pattern);
          vec3 col = mix(bright, hot, crustMask);
          col = mix(col, warm, crustMask * crustMask);
          col = mix(col, crust, smoothstep(0.65, 0.85, pattern));
          col += veins * bright * 0.6;
          col *= (pulse + ripple);

          // Irregular edge via noise
          float edgeNoise = fbm(vUv * 8.0 + 0.5) * 0.25;
          float alpha = smoothstep(1.0, 0.2, dist + edgeNoise) * 0.92;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Self-animate via onBeforeRender on first pool mesh
    let lavaTimeHooked = false;

    const poolGeo = new THREE.CircleGeometry(1, 24);
    poolGeo.rotateX(-Math.PI / 2);
    const glowGeo = new THREE.RingGeometry(0.8, 1.2, 24);
    glowGeo.rotateX(-Math.PI / 2);

    // Each "pool" is a cluster of 3-6 overlapping blobs forming an irregular shape
    const clusterCount = 40;
    for (let attempt = 0, placed = 0; placed < clusterCount && attempt < clusterCount * 4; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const edgeDist = 10 + rng() * 50;
      const dist = sp.width * 0.5 + edgeDist;
      const centerPos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

      const clearance = TrackEnvironment.checkTrackClearance(spline, centerPos, 8);
      if (!clearance) continue;

      // Match the ground drop applied in buildGround / buildTrees
      let baseY = clearance.y;
      const dropT = Math.max(1 - clearance.edgeDist / 25, 0);
      baseY -= 1.5 * dropT * dropT;
      // Sink slightly below ground so the pool sits flush, not floating
      baseY -= 0.1;

      const blobCount = 3 + Math.floor(rng() * 4); // 3-6 blobs per cluster
      const clusterAngle = rng() * Math.PI * 2;

      for (let b = 0; b < blobCount; b++) {
        // Offset each blob from center to form irregular shape
        const angle = clusterAngle + (b / blobCount) * Math.PI * 2 + (rng() - 0.5) * 1.2;
        const offsetDist = b === 0 ? 0 : rng() * 5 + 1.5;
        const bx = centerPos.x + Math.cos(angle) * offsetDist;
        const bz = centerPos.z + Math.sin(angle) * offsetDist;

        const scaleX = 3 + rng() * 6;
        const scaleZ = scaleX * (0.5 + rng() * 0.7);

        // Lava blob
        const blob = new THREE.Mesh(poolGeo, lavaPoolShader);
        blob.position.set(bx, baseY, bz);
        blob.scale.set(scaleX, 1, scaleZ);
        blob.rotation.y = rng() * Math.PI * 2;

        if (!lavaTimeHooked) {
          const mat = lavaPoolShader;
          blob.onBeforeRender = () => { mat.uniforms.uTime.value = performance.now() * 0.001; };
          lavaTimeHooked = true;
        }
        this.group.add(blob);

        // Glow rim for this blob
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.set(bx, baseY + 0.03, bz);
        glow.scale.set(scaleX * 1.15, 1, scaleZ * 1.15);
        glow.rotation.y = blob.rotation.y;
        this.group.add(glow);
      }

      // Bubbling / erupting particle column above this cluster
      const bubbleCount = 60;
      const bubblePositions = new Float32Array(bubbleCount * 3);
      const bubbleVelocities = new Float32Array(bubbleCount * 3);
      const bubbleLifetimes = new Float32Array(bubbleCount);
      const bubbleMaxLife = new Float32Array(bubbleCount);
      for (let i = 0; i < bubbleCount; i++) {
        bubbleLifetimes[i] = -rng() * 2; // staggered start
        bubbleMaxLife[i] = 0.8 + rng() * 1.5;
        bubblePositions[i * 3]     = centerPos.x + (rng() - 0.5) * 4;
        bubblePositions[i * 3 + 1] = baseY;
        bubblePositions[i * 3 + 2] = centerPos.z + (rng() - 0.5) * 4;
        bubbleVelocities[i * 3]     = (rng() - 0.5) * 2;
        bubbleVelocities[i * 3 + 1] = 3 + rng() * 6;
        bubbleVelocities[i * 3 + 2] = (rng() - 0.5) * 2;
      }
      const bubbleGeo = new THREE.BufferGeometry();
      bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePositions, 3));
      const bubbleMat = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 0.5,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const bubblePoints = new THREE.Points(bubbleGeo, bubbleMat);
      bubblePoints.frustumCulled = false;
      const bY = baseY;
      const cx = centerPos.x, cz = centerPos.z;
      bubblePoints.onBeforeRender = () => {
        const dt = 0.016; // ~60fps step
        const posAttr = bubbleGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < bubbleCount; i++) {
          bubbleLifetimes[i] += dt;
          if (bubbleLifetimes[i] > bubbleMaxLife[i] || bubbleLifetimes[i] < 0) {
            // Reset particle
            if (bubbleLifetimes[i] > bubbleMaxLife[i]) bubbleLifetimes[i] = 0;
            posAttr.setXYZ(i,
              cx + (Math.random() - 0.5) * 5,
              bY,
              cz + (Math.random() - 0.5) * 5,
            );
            bubbleVelocities[i * 3]     = (Math.random() - 0.5) * 3;
            bubbleVelocities[i * 3 + 1] = 3 + Math.random() * 7;
            bubbleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 3;
            bubbleMaxLife[i] = 0.6 + Math.random() * 1.2;
            continue;
          }
          const t = bubbleLifetimes[i] / bubbleMaxLife[i];
          const gravity = 6.0;
          posAttr.setXYZ(i,
            posAttr.getX(i) + bubbleVelocities[i * 3] * dt,
            posAttr.getY(i) + (bubbleVelocities[i * 3 + 1] - gravity * bubbleLifetimes[i]) * dt,
            posAttr.getZ(i) + bubbleVelocities[i * 3 + 2] * dt,
          );
          // Fade: hide when below surface or expired
          if (t > 0.85) {
            posAttr.setY(i, -9999);
          }
        }
        posAttr.needsUpdate = true;
      };
      this.group.add(bubblePoints);

      placed++;
    }

    // ── Fumarole smoke columns (translucent vertical wisps) ──
    const fumaroleCount = 10;
    const smokeGeo = new THREE.CylinderGeometry(0.3, 1.2, 1, 8, 1, true);
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x554433,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, fumaroleCount);

    // Small emissive base vent
    const ventGeo = new THREE.CylinderGeometry(0.6, 0.8, 0.4, 8);
    const ventMat = new THREE.MeshStandardMaterial({
      color: 0x442200,
      emissive: 0xff4400,
      emissiveIntensity: 0.6,
      roughness: 0.9,
    });
    const ventMesh = new THREE.InstancedMesh(ventGeo, ventMat, fumaroleCount);

    let fPlaced = 0;
    for (let attempt = 0; fPlaced < fumaroleCount && attempt < fumaroleCount * 4; attempt++) {
      const t = rng();
      const sp = spline.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const edgeDist = 5 + rng() * 20;
      const dist = sp.width * 0.5 + edgeDist;
      const pos = sp.position.clone().add(sp.binormal.clone().multiplyScalar(side * dist));

      const clearance = TrackEnvironment.checkTrackClearance(spline, pos, 3);
      if (!clearance) continue;

      const h = 6 + rng() * 10;
      // Smoke column
      dummy.position.copy(pos);
      dummy.position.y = clearance.y + h * 0.5;
      dummy.scale.set(1 + rng() * 1.5, h, 1 + rng() * 1.5);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.updateMatrix();
      smokeMesh.setMatrixAt(fPlaced, dummy.matrix);

      // Vent at base
      dummy.position.copy(pos);
      dummy.position.y = clearance.y + 0.2;
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      ventMesh.setMatrixAt(fPlaced, dummy.matrix);

      fPlaced++;
    }
    smokeMesh.count = fPlaced;
    ventMesh.count = fPlaced;
    smokeMesh.instanceMatrix.needsUpdate = true;
    ventMesh.instanceMatrix.needsUpdate = true;
    this.group.add(smokeMesh);
    this.group.add(ventMesh);

    // ── Giant volcano mountains (background scenery) ──
    const volcanoConfigs = [
      // ── Colossal volcanoes (distant, towering) ──
      { x: -80, z: 550, baseR: 200, height: 320, craterR: 24, active: true },
      { x: 500, z: 400, baseR: 180, height: 280, craterR: 22, active: true },
      // ── Large active volcanoes ──
      { x: 300, z: 300, baseR: 120, height: 180, craterR: 16, active: true },
      { x: 320, z: -150, baseR: 90, height: 130, craterR: 12, active: true },
      { x: -80, z: 400, baseR: 130, height: 200, craterR: 18, active: true },
      { x: -400, z: -300, baseR: 110, height: 165, craterR: 14, active: true },
      // ── Medium volcanoes ──
      { x: 180, z: -350, baseR: 75, height: 110, craterR: 10, active: true },
      { x: -300, z: 350, baseR: 85, height: 125, craterR: 11, active: false },
      { x: 450, z: -50, baseR: 70, height: 100, craterR: 9, active: false },
      // ── Dormant / small peaks ──
      { x: -350, z: 80, baseR: 100, height: 145, craterR: 13, active: false },
      { x: -500, z: -100, baseR: 60, height: 85, craterR: 8, active: false },
      { x: 150, z: 550, baseR: 65, height: 95, craterR: 8, active: false },
    ];

    for (const vc of volcanoConfigs) {
      const volcGroup = new THREE.Group();
      volcGroup.position.set(vc.x, -0.5, vc.z);

      // Main cone body — dark volcanic rock
      const bodyGeo = new THREE.ConeGeometry(vc.baseR, vc.height, 32, 8);
      // Distort vertices for natural irregular shape
      const bVerts = bodyGeo.getAttribute('position');
      const bodyRng = mulberry32(vc.x * 7 + vc.z * 13);
      for (let i = 0; i < bVerts.count; i++) {
        const y = bVerts.getY(i);
        const heightRatio = (y + vc.height * 0.5) / vc.height; // 0 at base, 1 at peak
        const noise = (bodyRng() - 0.5) * vc.baseR * 0.15 * (1 - heightRatio * 0.7);
        bVerts.setX(i, bVerts.getX(i) + noise);
        bVerts.setZ(i, bVerts.getZ(i) + noise);
        // Roughen the surface vertically too
        bVerts.setY(i, bVerts.getY(i) + (bodyRng() - 0.5) * 3 * (1 - heightRatio));
      }
      bodyGeo.computeVertexNormals();

      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x2a1a0e,
        roughness: 0.95,
        metalness: 0.05,
        emissive: 0x0a0400,
        emissiveIntensity: 0.2,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = vc.height * 0.5;
      body.castShadow = true;
      body.receiveShadow = true;
      volcGroup.add(body);

      // Crater — glowing lava inside the top
      const craterGeo = new THREE.CircleGeometry(vc.craterR, 16);
      craterGeo.rotateX(-Math.PI / 2);
      const craterMat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const crater = new THREE.Mesh(craterGeo, craterMat);
      crater.position.y = vc.height - 2;
      volcGroup.add(crater);

      // Crater glow halo — larger soft glow above crater
      const haloGeo = new THREE.CircleGeometry(vc.craterR * 2.5, 16);
      haloGeo.rotateX(-Math.PI / 2);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.y = vc.height + 1;
      volcGroup.add(halo);

      // Active volcano: tall smoke column at summit + magma eruption
      if (vc.active) {
        const smokeH = vc.height * 0.5;
        const smkGeo = new THREE.CylinderGeometry(vc.craterR * 0.5, vc.craterR * 2, smokeH, 10, 1, true);
        const smkMat = new THREE.MeshBasicMaterial({
          color: 0x443322,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const smoke = new THREE.Mesh(smkGeo, smkMat);
        smoke.position.y = vc.height + smokeH * 0.5;
        volcGroup.add(smoke);

        // Second wider, fainter plume
        const smk2Geo = new THREE.CylinderGeometry(vc.craterR * 1.5, vc.craterR * 4, smokeH * 1.2, 10, 1, true);
        const smk2Mat = new THREE.MeshBasicMaterial({
          color: 0x332211,
          transparent: true,
          opacity: 0.06,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const smoke2 = new THREE.Mesh(smk2Geo, smk2Mat);
        smoke2.position.y = vc.height + smokeH * 0.8;
        volcGroup.add(smoke2);

        // ── MASSIVE magma eruption — 3 layers of particles ──
        const craterY = vc.height - 2;

        // --- Layer 1: Large magma blobs (big, slow, dramatic arcs) ---
        const blobCount = 120;
        const blobPos = new Float32Array(blobCount * 3);
        const blobVel = new Float32Array(blobCount * 3);
        const blobLife = new Float32Array(blobCount);
        const blobMaxLife = new Float32Array(blobCount);
        const blobCol = new Float32Array(blobCount * 3);
        const blobSize = new Float32Array(blobCount);
        const eruptRng = mulberry32(vc.x * 41 + vc.z * 59);

        const hotPalette = [
          [1.0, 0.9, 0.4], [1.0, 0.7, 0.15], [1.0, 0.5, 0.08],
          [1.0, 0.35, 0.03], [0.95, 0.2, 0.02], [1.0, 1.0, 0.7],
        ];

        const resetBlob = (i: number, stagger: number) => {
          const a = Math.random() * Math.PI * 2;
          const outSpeed = 10 + Math.random() * 45;
          const upSpeed = 40 + Math.random() * 60;
          const sp2 = vc.craterR * (0.2 + Math.random() * 0.6);
          blobPos[i * 3]     = Math.cos(a) * sp2;
          blobPos[i * 3 + 1] = craterY;
          blobPos[i * 3 + 2] = Math.sin(a) * sp2;
          blobVel[i * 3]     = Math.cos(a) * outSpeed + (Math.random() - 0.5) * 8;
          blobVel[i * 3 + 1] = upSpeed;
          blobVel[i * 3 + 2] = Math.sin(a) * outSpeed + (Math.random() - 0.5) * 8;
          blobLife[i] = stagger;
          blobMaxLife[i] = 3 + Math.random() * 5;
          blobSize[i] = 2.5 + Math.random() * 4.0;
          const ci = Math.floor(Math.random() * hotPalette.length);
          blobCol[i * 3] = hotPalette[ci][0];
          blobCol[i * 3 + 1] = hotPalette[ci][1];
          blobCol[i * 3 + 2] = hotPalette[ci][2];
        };
        for (let i = 0; i < blobCount; i++) resetBlob(i, eruptRng() * 6);

        const blobGeo = new THREE.BufferGeometry();
        blobGeo.setAttribute('position', new THREE.BufferAttribute(blobPos, 3));
        blobGeo.setAttribute('color', new THREE.BufferAttribute(blobCol, 3));
        blobGeo.setAttribute('size', new THREE.BufferAttribute(blobSize, 1));
        const blobMat = new THREE.ShaderMaterial({
          uniforms: {},
          vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            void main() {
              vColor = color;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = size * (200.0 / -mv.z);
              gl_Position = projectionMatrix * mv;
            }
          `,
          fragmentShader: `
            varying vec3 vColor;
            void main() {
              float d = length(gl_PointCoord - 0.5) * 2.0;
              if (d > 1.0) discard;
              float glow = 1.0 - d * d;
              float core = smoothstep(0.6, 0.0, d);
              vec3 col = vColor * glow + vec3(1.0, 0.95, 0.8) * core * 0.5;
              float alpha = glow * 0.95;
              gl_FragColor = vec4(col, alpha);
            }
          `,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const blobPts = new THREE.Points(blobGeo, blobMat);
        blobPts.frustumCulled = false;

        // --- Layer 2: Small hot sparks (fast, numerous, spray effect) ---
        const sparkCount = 200;
        const sparkPos = new Float32Array(sparkCount * 3);
        const sparkVel = new Float32Array(sparkCount * 3);
        const sparkLife = new Float32Array(sparkCount);
        const sparkMaxLife = new Float32Array(sparkCount);
        const sparkCol = new Float32Array(sparkCount * 3);

        const resetSpark = (i: number, stagger: number) => {
          const a = Math.random() * Math.PI * 2;
          const outSpeed = 20 + Math.random() * 60;
          const upSpeed = 50 + Math.random() * 80;
          const sp2 = vc.craterR * 0.3;
          sparkPos[i * 3]     = Math.cos(a) * sp2;
          sparkPos[i * 3 + 1] = craterY;
          sparkPos[i * 3 + 2] = Math.sin(a) * sp2;
          sparkVel[i * 3]     = Math.cos(a) * outSpeed + (Math.random() - 0.5) * 15;
          sparkVel[i * 3 + 1] = upSpeed;
          sparkVel[i * 3 + 2] = Math.sin(a) * outSpeed + (Math.random() - 0.5) * 15;
          sparkLife[i] = stagger;
          sparkMaxLife[i] = 1.5 + Math.random() * 3;
          sparkCol[i * 3] = 1.0;
          sparkCol[i * 3 + 1] = 0.7 + Math.random() * 0.3;
          sparkCol[i * 3 + 2] = 0.2 + Math.random() * 0.3;
        };
        for (let i = 0; i < sparkCount; i++) resetSpark(i, eruptRng() * 4);

        const sparkGeo = new THREE.BufferGeometry();
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
        sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
        const sparkMat = new THREE.PointsMaterial({
          size: 1.2,
          vertexColors: true,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
        });
        const sparkPts = new THREE.Points(sparkGeo, sparkMat);
        sparkPts.frustumCulled = false;

        // --- Animation: drive all layers from one onBeforeRender ---
        let lastTime = -1;
        blobPts.onBeforeRender = () => {
          const now = performance.now() * 0.001;
          if (lastTime < 0) { lastTime = now; return; }
          const dt = Math.min(now - lastTime, 0.05);
          lastTime = now;

          const gravity = -25;

          // Blobs
          for (let i = 0; i < blobCount; i++) {
            blobLife[i] += dt;
            if (blobLife[i] >= blobMaxLife[i]) {
              resetBlob(i, 0);
              continue;
            }
            blobVel[i * 3 + 1] += gravity * dt;
            blobPos[i * 3]     += blobVel[i * 3] * dt;
            blobPos[i * 3 + 1] += blobVel[i * 3 + 1] * dt;
            blobPos[i * 3 + 2] += blobVel[i * 3 + 2] * dt;
            // Fade and shrink
            const lr = 1 - blobLife[i] / blobMaxLife[i];
            blobSize[i] *= (0.995 + lr * 0.005);
            blobCol[i * 3]     = hotPalette[0][0] * lr + 0.3 * (1 - lr);
            blobCol[i * 3 + 1] = hotPalette[0][1] * lr * lr;
            blobCol[i * 3 + 2] = hotPalette[0][2] * lr * lr * lr;
          }
          (blobGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          (blobGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
          (blobGeo.attributes.size as THREE.BufferAttribute).needsUpdate = true;

          // Sparks
          const sparkGravity = -35;
          for (let i = 0; i < sparkCount; i++) {
            sparkLife[i] += dt;
            if (sparkLife[i] >= sparkMaxLife[i]) {
              resetSpark(i, 0);
              continue;
            }
            sparkVel[i * 3 + 1] += sparkGravity * dt;
            sparkPos[i * 3]     += sparkVel[i * 3] * dt;
            sparkPos[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
            sparkPos[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
            const lr = 1 - sparkLife[i] / sparkMaxLife[i];
            sparkCol[i * 3]     = lr;
            sparkCol[i * 3 + 1] = lr * lr * 0.7;
            sparkCol[i * 3 + 2] = lr * lr * lr * 0.3;
          }
          (sparkGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
          (sparkGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
        };

        volcGroup.add(blobPts);
        volcGroup.add(sparkPts);
      }

      // Lava streaks — glowing lines running down the slope
      const streakCount = vc.active ? 5 : 2;
      const streakRng = mulberry32(vc.x * 23 + vc.z * 37);
      for (let s = 0; s < streakCount; s++) {
        const angle = streakRng() * Math.PI * 2;
        const topY = vc.height * (0.7 + streakRng() * 0.25);
        const botY = vc.height * (0.05 + streakRng() * 0.2);
        const topR = vc.craterR * (1.0 + streakRng() * 0.5);
        const botR = vc.baseR * (0.3 + streakRng() * 0.4);
        const width = 0.8 + streakRng() * 1.5;

        const pts: THREE.Vector3[] = [];
        const segments = 8;
        for (let j = 0; j <= segments; j++) {
          const t = j / segments;
          const r = topR + (botR - topR) * t;
          const y = topY + (botY - topY) * t;
          pts.push(new THREE.Vector3(
            Math.cos(angle) * r + (streakRng() - 0.5) * 2,
            y,
            Math.sin(angle) * r + (streakRng() - 0.5) * 2,
          ));
        }

        const curve = new THREE.CatmullRomCurve3(pts);
        const tubeGeo = new THREE.TubeGeometry(curve, 12, width, 4, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: vc.active ? 0xff5511 : 0x661100,
          transparent: true,
          opacity: vc.active ? 0.7 : 0.3,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        volcGroup.add(tube);
      }

      this.group.add(volcGroup);
    }

    // ── Lava lake (large glowing plane below ground, like frozen lake but molten) ──
    const lavaLakeGeo = new THREE.PlaneGeometry(1600, 1600);
    const lavaLakeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv * 12.0;
          float n = sin(uv.x * 1.3 + uTime * 0.4) * cos(uv.y * 1.1 - uTime * 0.3)
                  + sin(uv.x * 0.7 - uTime * 0.5 + uv.y * 0.9) * 0.5;
          n = n * 0.5 + 0.5;
          vec3 hot  = vec3(1.0, 0.35, 0.05);
          vec3 cool = vec3(0.25, 0.06, 0.01);
          vec3 col = mix(cool, hot, n);
          gl_FragColor = vec4(col, 0.55);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const lavaLake = new THREE.Mesh(lavaLakeGeo, lavaLakeMat);
    lavaLake.rotation.x = -Math.PI / 2;
    lavaLake.position.y = -2.0;
    lavaLake.onBeforeRender = () => { lavaLakeMat.uniforms.uTime.value = performance.now() * 0.001; };
    this.group.add(lavaLake);
  }

  clear(): void {
    this.treePositions = [];
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  }
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
