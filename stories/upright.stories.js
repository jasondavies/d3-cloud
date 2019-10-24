import {action} from '@storybook/addon-actions';
import * as samples from './support/text_samples'
import {cloudTest} from "./support/cloud_test";
import {
    array,
    boolean,
    button,
    color,
    date,
    select,
    withKnobs,
    text,
    number,
} from '@storybook/addon-knobs';

export default {
    title: 'Word Cloud | Upright',
    decorators: [withKnobs],
};

const options = {angle: 90};

export const words = () => {
    return cloudTest(samples.WORDS, options);
};

export const phrase = () => {
    return cloudTest(samples.SENTENCE, options);
};

export const loremShort = () => {
    return cloudTest(samples.LOREM_SHORT, options);
};

export const loremLong = () => {
    return cloudTest(samples.LOREM_LONG, options);
};
