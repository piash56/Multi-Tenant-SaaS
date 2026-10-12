import { Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets";
import { realtimeEventNames } from "@saas/shared-types";
import type { Server, Socket } from "socket.io";

@WebSocketGateway({ namespace: "/realtime", transports: ["websocket", "polling"] })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(client: Socket): void {
    this.logger.debug({ socketId: client.id }, "Realtime client connected");
    client.emit(realtimeEventNames.connected, { timestamp: new Date().toISOString() });
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug({ socketId: client.id }, "Realtime client disconnected");
  }
}
