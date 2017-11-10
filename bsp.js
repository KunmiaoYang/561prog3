const VALID_THRESHOLD = 0.00000001;

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
            for(let i = 0; i < 3; i++) {
                if (this.tri.isFront(tri.p[i])) frontPoints.push(tri.p[i]);
                else backPoints.push(tri.p[i]);
            }
            if(0 === frontPoints.length) {
                if(null === this.back) this.back = new BSP();
                this.back.add(tri);
            } else if(0 === backPoints.length) {
                if(null === this.front) this.front = new BSP();
                this.front.add(tri);
            } else {
                if(null === this.back) this.back = new BSP();
                if(null === this.front) this.front = new BSP();
                if(frontPoints.length > backPoints.length) {
                    this.split(frontPoints, backPoints[0], this.front, this.back);
                } else {
                    this.split(backPoints, frontPoints[0], this.back, this.front);
                }
            }
        }
    }

    split(twoPoints, point, twoNode, oneNode) {
        let p0 = this.tri.calcIntersect(twoPoints[0], point);
        let p1 = this.tri.calcIntersect(twoPoints[1], point);
        let t0 = new Triangle(), t1 = new Triangle(), t2 = new Triangle();
        t0.setByPoints(point, p0, p1);
        t1.setByPoints(twoPoints[0], p1, p0);
        t2.setByPoints(twoPoints[0], twoPoints[1], p1);
        oneNode.add(t0);
        twoNode.add(t1);
        twoNode.add(t2);
    }
}

class Triangle {
    constructor() {
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
        this.p[0] = vec3.set(vec3.create(), array[base], array[base+1], array[base+2]);
        this.p[1] = vec3.set(vec3.create(), array[base+3], array[base+4], array[base+5]);
        this.p[2] = vec3.set(vec3.create(), array[base+6], array[base+7], array[base+8]);
        this.calcN();
        this.calcOffset();
    }

    calcN() {
        let v0 = vec3.subtract(vec3.create(), this.p[0], this.p[2]);
        let v1 = vec3.subtract(vec3.create(), this.p[1], this.p[2]);
        this.n = vec3.cross(vec3.create(), v0, v1);
        this.valid = (vec3.length(this.n) > VALID_THRESHOLD);
    }

    calcOffset() {
        this.offset = vec3.dot(this.p[0], this.n);
    }

    calcIntersect(p1, p2) {
        let v = vec3.subtract(vec3.create(), p2, p1);
        let a = (this.offset - vec3.dot(p1, this.n)) / vec3.dot(v, this.n);
        return vec3.scaleAndAdd(vec3.create(), p1, v, a);
    }

    isFront(point) {
        return vec3.dot(point, this.n) > this.offset;
    }
}

var bsp = new BSP();
function testBSP() {
    let t1 = new Triangle(), t2 = new Triangle(), t3 = new Triangle();
    let data = [0,0,0, 3,3,3, 0,3,0, 0,0,0, 2,0,0, 0,0,2, 0,0,0, 4,0,0, 4,4,0];
    t1.setByArray(data, 0);
    t2.setByArray(data, 9);
    t3.setByArray(data, 18);
    bsp.add(t1);
    bsp.add(t2);
    bsp.add(t3);
}