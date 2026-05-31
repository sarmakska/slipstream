// Command line wrapper for the sample project.
import { main } from "./index.js";

export class SampleCli {
  run(): void {
    console.log(main());
  }
}
