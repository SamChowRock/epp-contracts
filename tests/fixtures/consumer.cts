import { miniProgramSceneSchema } from '@szepp/contracts';
import { miniProgramListQuerySchema } from '@szepp/contracts/mini-program';
import { starMapListQuerySchema } from '@szepp/contracts/fields';

const scene: string = miniProgramSceneSchema.parse('A'.repeat(26));
const limit: number = miniProgramListQuerySchema.parse({}).limit;
const fieldsLimit: number = starMapListQuerySchema.parse({}).limit;
// @ts-expect-error Parsed scenes must retain their string type.
const invalid: number = miniProgramSceneSchema.parse(scene);
