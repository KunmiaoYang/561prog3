const VALID_THRESHOLD = 1e-6;
const PARALLEL_THRESHOLD = 1e-6;

class BSP {
    constructor() {
        this.tri = null;
        this.back = null;
        this.front = null;
    }

    add(tri) {
        if(!tri.valid) return;
        if(null === this.tri) {
            this.tri = tri;
        } else {
            let frontPoints = [], backPoints = [];
            let par = (Math.abs(1 - Math.abs(vec3.dot(this.tri.n, tri.n))) < PARALLEL_THRESHOLD);
            for(let i = 0; i < 3; i++) {
                if (this.tri.isFront(tri.p[i])) frontPoints.push(tri.p[i]);
                else backPoints.push(tri.p[i]);
            }
            if(0 === frontPoints.length || par && 1 === frontPoints.length) {
                if(null === this.back) this.back = new BSP();
                this.back.add(tri);
            } else if(0 === backPoints.length || par && 1 === backPoints.length) {
                if(null === this.front) this.front = new BSP();
                this.front.add(tri);
            } else {
                if(null === this.back) this.back = new BSP();
                if(null === this.front) this.front = new BSP();
                if(frontPoints.length > backPoints.length) {
                    this.split(frontPoints, backPoints[0], this.front, this.back, tri.model);
                } else {
                    this.split(backPoints, frontPoints[0], this.back, this.front, tri.model);
                }
            }
        }
    }

    split(twoPoints, point, twoNode, oneNode, model) {
        let p0 = this.tri.calcIntersect(twoPoints[0], point);
        let p1 = this.tri.calcIntersect(twoPoints[1], point);
        let t0 = new Triangle(model.slice()), t1 = new Triangle(model.slice()), t2 = new Triangle(model.slice());
        t0.setByPoints(point, p0, p1);
        t1.setByPoints(twoPoints[0], p1, p0);
        t2.setByPoints(twoPoints[0], twoPoints[1], p1);
        oneNode.add(t0);
        twoNode.add(t1);
        twoNode.add(t2);
    }
}

var tri_id = 0;
class Triangle {
    constructor(model) {
        this.id = tri_id++;
        this.model = model;
        this.p = [];
    }

    setByPoints(p0, p1, p2) {
        this.p[0] = p0;
        this.p[1] = p1;
        this.p[2] = p2;
        this.calcN();
        this.calcOffset();
    }

    setByArray(array, base) {
        this.p[0] = vec3.set(vec3.create(), array[base[0]], array[base[0]+1], array[base[0]+2]);
        this.p[1] = vec3.set(vec3.create(), array[base[1]], array[base[1]+1], array[base[1]+2]);
        this.p[2] = vec3.set(vec3.create(), array[base[2]], array[base[2]+1], array[base[2]+2]);
        this.calcN();
        this.calcOffset();
    }

    setByArrayMatrix(array, base, matrix) {
        this.p0 = [];
        this.p0[0] = vec3.set(vec3.create(), array[base[0]], array[base[0]+1], array[base[0]+2]);
        this.p0[1] = vec3.set(vec3.create(), array[base[1]], array[base[1]+1], array[base[1]+2]);
        this.p0[2] = vec3.set(vec3.create(), array[base[2]], array[base[2]+1], array[base[2]+2]);
        this.p[0] = vec3.transformMat4(vec3.create(), this.p0[0], matrix);
        this.p[1] = vec3.transformMat4(vec3.create(), this.p0[1], matrix);
        this.p[2] = vec3.transformMat4(vec3.create(), this.p0[2], matrix);
        this.calcN();
        this.calcOffset();
    }

    setNormalByArray(array, base) {
        this.p[0].n = [array[base[0]], array[base[0]+1], array[base[0]+2]];
        this.p[1].n = [array[base[1]], array[base[1]+1], array[base[1]+2]];
        this.p[2].n = [array[base[2]], array[base[2]+1], array[base[2]+2]];
    }

    setUVByArray(array, base) {
        this.p[0].uv = [array[base[0]], array[base[0]+1]];
        this.p[1].uv = [array[base[1]], array[base[1]+1]];
        this.p[2].uv = [array[base[2]], array[base[2]+1]];
    }

    calcN() {
        let v0 = vec3.subtract(vec3.create(), this.p[0], this.p[2]);
        let v1 = vec3.subtract(vec3.create(), this.p[1], this.p[2]);
        this.n = vec3.cross(vec3.create(), v0, v1);
        let length = vec3.length(this.n);
        this.valid = (length > VALID_THRESHOLD);
        if(this.valid) this.n = vec3.scale(vec3.create(), this.n, 1.0/length);
    }

    calcOffset() {
        this.offset = vec3.dot(this.p[0], this.n);
    }

    calcIntersect(p1, p2) {
        let v = vec3.subtract(vec3.create(), p2, p1), a;
        let dot = vec3.dot(v, this.n);
        if(dot < PARALLEL_THRESHOLD) a = 1;
        else a = (this.offset - vec3.dot(p1, this.n)) / dot;
        let p = vec3.scaleAndAdd(vec3.create(), p1, v, a);
        p.n = vec3.lerp(vec3.create(), p1.n, p2.n, a);
        p.uv = vec2.lerp(vec2.create(), p1.uv, p2.uv, a);
        return p;
    }

    isFront(point) {
        return vec3.dot(point, this.n) > this.offset;
    }
}

var bsp = new BSP();
function testBSP() {
    let t1 = new Triangle(1), t2 = new Triangle(2), t3 = new Triangle(3);
    let data = [0,0,0, 3,3,3, 0,3,0, 0,0,0, 2,0,0, 0,0,2, 0,0,0, 4,0,0, 4,4,0];
    t1.setByArray(data, 0);
    t2.setByArray(data, 9);
    t3.setByArray(data, 18);
    t1.setNormalByArray(data, 0);
    t2.setNormalByArray(data, 0);
    t3.setNormalByArray(data, 0);
    t1.setUVByArray(data, 0);
    t2.setUVByArray(data, 0);
    t3.setUVByArray(data, 0);
    bsp.add(t1);
    bsp.add(t2);
    bsp.add(t3);
}