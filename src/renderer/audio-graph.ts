import lo from "lodash";
import {FibonacciHeap, INode} from "@tyriar/fibonacci-heap";

export interface AudioComputationNode<T> {
    readonly id: number;
    readonly value: T;
    readonly edges: { [id: number]: number };
}

export class AudioComputationGraph<T> {
    private readonly nodes: Array<AudioComputationNode<T>>;

    constructor() {
        this.nodes = [];
    }

    clone(): AudioComputationGraph<T> {
        const out = new AudioComputationGraph<T>();
        this.nodes.forEach(n => out.addNode(n.value));
        out.nodes.forEach(n => Object.entries(this.nodes[n.id].edges).forEach(p => out.addDirectedEdge(n, out.nodes[+p[0]], p[1])))
        return out;
    }

    getNodes(): ReadonlyArray<AudioComputationNode<T>> {
        return this.nodes;
    }

    addNode<S extends T>(value: S): AudioComputationNode<S> {
        const node: AudioComputationNode<S> = {
            id: this.nodes.length,
            value: value,
            edges: {}
        };
        this.nodes.push(node);
        return node;
    }

    addEdge(n0: AudioComputationNode<T>, n1: AudioComputationNode<T>, distance: number): void {
        n0.edges[n1.id] = distance;
        n1.edges[n0.id] = distance;
    }

    addDirectedEdge(n0: AudioComputationNode<T>, n1: AudioComputationNode<T>, distance: number): void {
        n0.edges[n1.id] = distance;
        // n1.edges[n0.id] = distance;
    }

    computeSPT(source: AudioComputationNode<T>): AudioPathTree<T> {
        const nodeCount = this.nodes.length;

        const distances = lo.times(nodeCount, lo.constant(Number.POSITIVE_INFINITY));
        const previous = lo.times(nodeCount, lo.constant<AudioComputationNode<T> | undefined>(undefined));
        distances[source.id] = 0;
        const heap = new FibonacciHeap<number, AudioComputationNode<T>>();
        const heapNodes: Array<INode<number, AudioComputationNode<T>>> = [];
        this.nodes.forEach(n => heapNodes[n.id] = heap.insert(distances[n.id], n));

        while (heap.size() > 0) {
            const node = heap.extractMinimum()?.value;
            if (node == undefined) {
                throw new Error("This is a bad error description, but should never be thrown");
            }
            Object.entries(node.edges).forEach(pair => {
                const id = +pair[0];
                const alt = distances[node.id] + pair[1];
                if (alt < distances[id]) {
                    distances[id] = alt;
                    previous[id] = node;
                    heap.decreaseKey(heapNodes[id], alt);
                }
            })
        }
        return new AudioPathTree(source, previous, distances);
    }
}

class AudioPathTree<T> {
    private readonly source: AudioComputationNode<T>;
    private readonly previousNodes: Array<AudioComputationNode<T> | undefined>;
    // @ts-ignore
    private readonly distances: Array<number>;


    constructor(
        source: AudioComputationNode<T>,
        previousNodes: Array<AudioComputationNode<T> | undefined>,
        distances: Array<number>
    ) {
        this.source = source;
        this.previousNodes = previousNodes;
        this.distances = distances;
    }

    getPathsTo(dest: AudioComputationNode<T>): Array<Array<AudioComputationNode<T>>> {
        const output: Array<Array<AudioComputationNode<T>>> = [];

        const path: AudioComputationNode<T>[] = [];
        let node = dest;

        while (this.previousNodes[node.id] != undefined) {
            path.push(node);
            // @ts-ignore
            node = this.previousNodes[node.id];
            if (node === this.source) {
                output.push(path);
                break;
            }
        }
        return output;
    }
}