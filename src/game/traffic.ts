import * as THREE from 'three';
import { buildTrafficVehicle, TrafficKind } from './models';
import { getTerrainHeight, ROAD_NETWORK } from './terrain';
import { ProceduralTextureSet } from './textures';
import { TrafficDensity } from './types';

interface TrafficAgent {
  mesh: THREE.Group;
  roadIndex: number;
  nodeIndex: number;
  t: number;
  dir: 1 | -1;
  speedMs: number;
  baseSpeedMs: number;
  x: number;
  y: number;
  z: number;
  heading: number;
}

export class NepalTrafficManager {
  private root = new THREE.Group();
  private agents: TrafficAgent[] = [];
  private activeCount = 12;

  constructor(
    scene: THREE.Scene,
    textures: ProceduralTextureSet,
    density: TrafficDensity
  ) {
    scene.add(this.root);
    const kinds: TrafficKind[] = ['microbus', 'car', 'truck', 'bus', 'microbus', 'car'];
    // Pre-allocate 18 vehicles in pool and toggle visibility based on density
    const drivableRoads = [0, 1, 2, 3, 5, 6, 9, 12];

    for (let i = 0; i < 18; i++) {
      const kind = kinds[i % kinds.length];
      const mesh = buildTrafficVehicle(kind, textures);
      this.root.add(mesh);
      const roadIndex = drivableRoads[i % drivableRoads.length];
      const road = ROAD_NETWORK[roadIndex];
      const nodeIndex = i % Math.max(1, road.nodes.length - (road.closed ? 0 : 1));
      const baseSpeedMs = kind === 'truck' || kind === 'bus' ? 8.5 : 11.5 + (i % 4) * 1.4;

      this.agents.push({
        mesh,
        roadIndex,
        nodeIndex,
        t: (i * 0.37) % 1,
        dir: i % 2 === 0 ? 1 : -1,
        speedMs: baseSpeedMs,
        baseSpeedMs,
        x: 0,
        y: 0,
        z: 0,
        heading: 0,
      });
    }

    this.setDensity(density);
    // Initialize positions immediately
    this.update(0.016, 9999, 9999);
  }

  public setDensity(density: TrafficDensity): void {
    this.activeCount = density === 'low' ? 7 : density === 'medium' ? 12 : 18;
    for (let i = 0; i < this.agents.length; i++) {
      this.agents[i].mesh.visible = i < this.activeCount;
    }
  }

  public update(dt: number, playerX: number, playerZ: number): void {
    const clampedDt = Math.min(dt, 0.05);

    for (let i = 0; i < this.activeCount; i++) {
      const a = this.agents[i];
      const road = ROAD_NETWORK[a.roadIndex];
      const nodes = road.nodes;
      const segCount = road.closed ? nodes.length : nodes.length - 1;
      if (segCount <= 0) continue;

      const idxA = ((a.nodeIndex % nodes.length) + nodes.length) % nodes.length;
      const idxB = (idxA + 1) % nodes.length;
      const nA = nodes[idxA];
      const nB = nodes[idxB];
      const segDx = nB.x - nA.x;
      const segDz = nB.z - nA.z;
      const segLen = Math.hypot(segDx, segDz) || 1;

      // Simple collision avoidance: slow down if player is directly ahead
      const distToPlayer = Math.hypot(a.x - playerX, a.z - playerZ);
      const targetSpeed = distToPlayer < 13 ? 0 : distToPlayer < 24 ? a.baseSpeedMs * 0.4 : a.baseSpeedMs;
      a.speedMs += (targetSpeed - a.speedMs) * Math.min(1, clampedDt * 4);

      a.t += (a.dir * a.speedMs * clampedDt) / segLen;

      if (a.t > 1) {
        a.t -= 1;
        if (road.closed) {
          a.nodeIndex = (a.nodeIndex + 1) % nodes.length;
        } else if (a.nodeIndex + 1 < segCount) {
          a.nodeIndex += 1;
        } else {
          a.dir = -1;
          a.t = 1;
        }
      } else if (a.t < 0) {
        a.t += 1;
        if (road.closed) {
          a.nodeIndex = (a.nodeIndex - 1 + nodes.length) % nodes.length;
        } else if (a.nodeIndex > 0) {
          a.nodeIndex -= 1;
        } else {
          a.dir = 1;
          a.t = 0;
        }
      }

      const curA = nodes[((a.nodeIndex % nodes.length) + nodes.length) % nodes.length];
      const curB = nodes[(a.nodeIndex + 1) % nodes.length];
      const dx = curB.x - curA.x;
      const dz = curB.z - curA.z;
      const len = Math.hypot(dx, dz) || 1;

      // Nepal drives on the LEFT side of the road!
      // Travel vector = (dir * dx/len, dir * dz/len); Left vector = (tz, -tx)
      const tx = (dx / len) * a.dir;
      const tz = (dz / len) * a.dir;
      const leftX = tz;
      const leftZ = -tx;
      const laneOffset = road.width * 0.24;

      a.x = curA.x + dx * a.t + leftX * laneOffset;
      a.z = curA.z + dz * a.t + leftZ * laneOffset;
      a.y = getTerrainHeight(a.x, a.z);
      a.heading = Math.atan2(-tx, -tz);

      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.rotation.y = a.heading;
    }
  }

  public setVisible(visible: boolean): void {
    this.root.visible = visible;
  }

  public clearNear(px: number, pz: number, radius: number): void {
    for (let i = 0; i < this.activeCount; i++) {
      const a = this.agents[i];
      if (Math.hypot(a.x - px, a.z - pz) < radius) {
        a.t = (a.t + 0.45) % 1;
        a.nodeIndex = (a.nodeIndex + 1) % ROAD_NETWORK[a.roadIndex].nodes.length;
      }
    }
    this.update(0.016, px, pz);
  }

  public checkPlayerCollision(px: number, pz: number): { hit: boolean; pushX: number; pushZ: number } {
    for (let i = 0; i < this.activeCount; i++) {
      const a = this.agents[i];
      const dx = px - a.x;
      const dz = pz - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.25 && d > 0.001) {
        return { hit: true, pushX: dx / d, pushZ: dz / d };
      }
    }
    return { hit: false, pushX: 0, pushZ: 0 };
  }
}
