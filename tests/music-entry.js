import { selectScorePart, publishedScoreXML, publishedScoreData } from '../src/score-view.js';
import * as music from '../src/music.js';
import { Midi } from '@tonejs/midi';
import { zipSync,strToU8 } from 'fflate';
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
window.testMusic={selectScorePart,publishedScoreXML,publishedScoreData,...music,Midi,zipSync,strToU8,OpenSheetMusicDisplay};
