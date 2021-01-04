import lo from "lodash";
import {AudioComputationGraph} from "./audio-graph";


export type Point = readonly [number, number];
export type Line = readonly [Point, Point];

export class AudioMap{
    readonly lines: ReadonlyArray<Line>;
    readonly nodes: ReadonlyArray<Point>;
    readonly dimensions: readonly [Point, Point];

    //TODO add safety checks
    constructor(svg: string) {
        const json = svgXmlToJson(svg);

        const arr = json.svg[0].g;
        const layers: { [id: string]: any; } = {};
        for (let i = 0; i < arr.length; i++) {
            layers[arr[i].attr.id] = arr[i];
        }
        const polys = layers.polygon_layer.polygon;
        const lines: Array<Line> = [];
        for (let i = 0; i < polys.length; i++) {
            const points: Array<Point> = polys[i].attr.points
                .replace(/,\s*/, ",").trim().split(/\s+/)
                .map((s: string) => s.split(",").map(sn => +sn));
            for (let j = 0; j < points.length; j++) {
                lines.push([points[j], points[(j + 1) % points.length]]);
            }
        }
        const circles = layers.node_layer.circle;
        const nodes: Array<Point> = circles.map((c: any) => c.attr)
            .map((a: any) => [+a.cx, +a.cy]);
        const dimVals = json.svg[0].attr.viewBox.trim().split(/\s+/).map((s: string) => +s);
        this.lines = lines;
        this.nodes = nodes;
        this.dimensions = [[dimVals[0], dimVals[1]], [dimVals[2], dimVals[3]]];
    }
}

function svgXmlToJson(svg: string): any {
    const parser = require('fast-xml-parser');
    var options = {
        attributeNamePrefix: "",
        attrNodeName: "attr",
        ignoreAttributes: false,
        attrValueProcessor: (val: any, n: any) => val,
        tagValueProcessor: (val: any, n: any) => val,
        arrayMode: true
    };
    if (parser.validate(svg) === true) {
        return parser.parse(svg, options);
    }
    return undefined;
}

export class ZonedAudioMap{
    readonly base: Point;
    readonly zoneInterval: number;
    readonly speakingRadius: number;
    readonly zones: ReadonlyArray<ReadonlyArray<MapZone>>;

    constructor(speakingRadius: number, audioMap: AudioMap) {
        const size = audioMap.dimensions[1].map((v, i) => Math.abs(v - audioMap.dimensions[0][i]));
        this.speakingRadius = speakingRadius;
        this.zoneInterval = this.speakingRadius / 2;
        const coverage = this.speakingRadius + this.zoneInterval;
        const zoneCounts = size.map(v => Math.floor(v / this.zoneInterval));
        this.base = audioMap.dimensions[0];
        let index: [number, number] = [0, 0];
        const zones: MapZone[][] = [];
        for (index[0] = 0; index[0] < zoneCounts[0]; index[0]++) {
            const xZones: Array<MapZone> = [];
            for (index[1] = 0; index[1] < zoneCounts[1]; index[1]++) {
                const center: Point = [0, 1].map(i => this.base[i] + index[i] * this.zoneInterval) as unknown as Point;
                const zone: MapZone = {
                    lines: audioMap.lines.filter(line => Geometry.withinCircle(center, coverage, line)),
                    graph: new AudioComputationGraph<Point>()
                }
                const nodes = lo(audioMap.nodes).filter(point => Geometry.dist(point, center) <= coverage)
                    .map(point => zone.graph.addNode(point)).value()
                nodes.forEach(node => {
                    lo(nodes)
                        .filter(n => n != node)
                        .filter(n => lo(zone.lines).filter(l => Geometry.intersects(l, [node.value, n.value])).isEmpty())
                        .forEach(n => zone.graph.addDirectedEdge(node, n, Geometry.dist(node.value, n.value)))
                })
                xZones.push(zone);
            }
            zones.push(xZones);
        }
        this.zones = zones;
    }

    getZoneForPoint(point: Point): MapZone | undefined{
        const index: Point = [0, 1].map(i => Math.floor((point[i] - this.base[i])/this.zoneInterval)) as unknown as Point;
        if(index[0]<0 || index[0] > this.zones.length-1 || index[1] < 0 || index[1] > this.zones[0].length-1){
            return undefined;
        }
        return this.zones[index[0]][index[1]];
    }

}
export const Geometry:any = {
    dist(p0: Point, p1: Point): number {
        return Math.sqrt(Math.pow(p0[0] - p1[0], 2) + Math.pow(p0[1] - p1[1], 2));
    },

    intersects(l0: Line, l1: Line): boolean {
        let delta, gamma, lambda;
        delta = (l0[1][0] - l0[0][0]) * (l1[1][1] - l1[0][1]) - (l1[1][0] - l1[0][0]) * (l0[1][1] - l0[0][1]);
        if (delta === 0) {
            return false;
        }
        lambda = ((l1[1][1] - l1[0][1]) * (l1[1][0] - l0[0][0]) + (l1[0][0] - l1[1][0]) * (l1[1][1] - l0[0][1])) / delta;
        gamma = ((l0[0][1] - l0[1][1]) * (l1[1][0] - l0[0][0]) + (l0[1][0] - l0[0][0]) * (l1[1][1] - l0[0][1])) / delta;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    },

    withinCircle(center: Point, radius: number, line: Line): boolean {
        if (line.find(p => Geometry.dist(center, p) <= radius) != undefined) {
            return true
        }
        const vectorL1L2: Point = [line[1][0] - line[0][0], line[1][1] - line[0][1]];
        const normL1L2 = Geometry.dist(vectorL1L2, [0, 0]);
        const unitL1L2 = vectorL1L2.map(a => a / normL1L2);
        const vectorL1C = [center[0] - line[0][0], center[1] - line[0][1]];
        return Math.abs(unitL1L2[0] * vectorL1C[1] - unitL1L2[1] * vectorL1C[0]) < radius;
    }
};
export interface MapZone {
    readonly lines: ReadonlyArray<Line>;
    readonly graph: AudioComputationGraph<Point>;
}