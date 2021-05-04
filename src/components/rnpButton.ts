import snip from "../snip";

export const mode = ["text", "outlined", "contained"];

export const rounded = [true, false];

export const description = `React Native Paper Button`;

export const body = snip`
<Button mode="\${#${mode}}" onPress={$#} $0>
    $#
</Button>
`;
