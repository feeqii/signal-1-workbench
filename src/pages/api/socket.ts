import type { NextApiRequest } from "next";
import type { NextApiResponseServerIO } from "@/types/socket";
import { Server as IOServer } from "socket.io";

export const config = {
  api: {
    bodyParser: false
  }
};

export default function handler(_req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: "/api/socket/io",
      addTrailingSlash: false,
      cors: {
        origin: "*"
      }
    });

    io.on("connection", (socket) => {
      socket.on("join-room", (roomId: string, userId: string) => {
        socket.join(roomId);
        socket.to(roomId).emit("peer-joined", { userId });
      });

      socket.on(
        "cursor",
        (payload: { roomId: string; userId: string; x: number; y: number }) => {
          socket.to(payload.roomId).emit("cursor", payload);
        }
      );

      socket.on(
        "annotation",
        (payload: { roomId: string; userId: string; annotation: unknown }) => {
          socket.to(payload.roomId).emit("annotation", payload);
        }
      );
    });

    res.socket.server.io = io;
  }

  res.end();
}
