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
    title: 'Word Cloud | Slanted',
    decorators: [withKnobs],
};

const options = {angle: 45};

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

export const ownText = () => {
    const words = text(
        'Words',
        `You can, put your own words in here. Separate them by space`);
    return cloudTest(words.split(' '), options);
};



