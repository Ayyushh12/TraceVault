import { graphService } from '../services/graphService.js';

export class GraphController {
    async getGraphData(request, reply) {
        const data = await graphService.generateGraphData();
        return reply.send({
            success: true,
            data
        });
    }
}

export const graphController = new GraphController();
