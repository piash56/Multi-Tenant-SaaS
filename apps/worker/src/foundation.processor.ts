import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

export const FOUNDATION_QUEUE = "foundation";

@Processor(FOUNDATION_QUEUE)
export class FoundationProcessor extends WorkerHost {
  private readonly logger = new Logger(FoundationProcessor.name);

  async process(job: Job<unknown, unknown, string>): Promise<void> {
    this.logger.log({ jobId: job.id, jobName: job.name }, "Foundation verification job received");
  }
}
