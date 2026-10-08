---
name: storybook
description: Document UI components in Storybook with CSF3 stories, autodocs, controls and an AllStates story that mirrors the design's state sheet. Use when creating or changing a reusable component in a project that has Storybook.
user-invocable: true
---

# Storybook

## 1. Detect the setup
- Read `package.json` for the Storybook major version and framework package (`@storybook/angular`, `@storybook/react-vite`, ...). Use the APIs of that version.
- Read `.storybook/main.*` and `.storybook/preview.*`: story globs, addons, global decorators.
- **Global styles:** make sure the token and global stylesheets are loaded in Storybook (Angular: the `styles` option of the Storybook target in `angular.json`, or an import in `preview.ts`). Without them every story is visually wrong.
- Recommended addons when missing (ask before adding): `@storybook/addon-a11y` for accessibility checks.

## 2. Story file conventions
- Co-located: `button.stories.ts` next to `button.ts`.
- CSF3 with typed `Meta` and `StoryObj`. `tags: ['autodocs']` so a docs page is generated.
- `title` follows the project hierarchy (default: `Components/<Name>`, `Patterns/<Name>`, `Pages/<Name>`).
- `args` hold the default inputs; `argTypes` describe variants as `select`/`radio` controls; outputs are wired as actions.
- One story per meaningful variant or state, named for what it shows (`Primary`, `Disabled`, `WithIcon`, `Loading`).
- Component docs: a short description via `parameters.docs.description.component` or a JSDoc comment on the class.

## 3. Angular example
```ts
import type { Meta, StoryObj } from '@storybook/angular';
import { Button } from './button';

const meta: Meta<Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  args: { variant: 'primary', disabled: false },
  argTypes: {
    variant: { control: 'radio', options: ['primary', 'secondary', 'ghost'] },
    pressed: { action: 'pressed' },
  },
  render: args => ({
    props: args,
    template: `<app-button [variant]="variant" [disabled]="disabled" (pressed)="pressed($event)">Label</app-button>`,
  }),
};
export default meta;
type Story = StoryObj<Button>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Disabled: Story = { args: { disabled: true } };
```
Use `moduleMetadata` / `applicationConfig` decorators for dependencies (e.g. `provideHttpClient()`, `provideRouter([])`, providers for icons).

## 4. The AllStates story (pairs with the reference image)
Each component that has a reference state sheet (`design/screens/<component>.png` by default) gets an `AllStates` story that **reproduces the sheet's layout**: same grid, same order, same labels, same background and canvas size. This story is what the `visual-check` skill compares against the reference.
- `parameters: { layout: 'fullscreen', controls: { disable: true } }` so Storybook adds no padding.
- Render every state statically. For hover, focus and active, add a forcing mechanism the component supports (e.g. a class like `is-hover` applied only in stories) or use the pseudo-states addon if the project has it. Never change production behavior for this.
- Wrap the grid in a container sized to the reference image at 1x (e.g. `width: 960px; height: 540px`) with the same background color.
- Keep labels and captions from the sheet only if they are part of the design image.

## 5. Quality bar
- Every story renders without console errors.
- Controls work for every public input.
- Text content is realistic (no lorem ipsum when the design shows real copy).
- Stories never call real APIs; mock data and providers.
