import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ProctoringModule } from '../proctoring/proctoring.module';

@Module({
  imports: [forwardRef(() => ProctoringModule)],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
