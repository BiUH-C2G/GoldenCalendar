import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default [
  { ignores: ['dist/**', 'public/data/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser, sourceType: 'module', extraFileExtensions: ['.vue'] } },
    rules: {
      semi: ['error', 'never'],
      quotes: ['error', 'single', { allowTemplateLiterals: true }],
      'comma-dangle': 'off',
      'no-undef': 'off',
      'preserve-caught-error': 'off',
      'vue/html-indent': ['error', 2],
      'vue/html-closing-bracket-spacing': 'off',
      'vue/html-self-closing': ['error', { html: { void: 'never', normal: 'always', component: 'always' }, svg: 'always', math: 'always' }],
      'vue/max-attributes-per-line': 'off',
      'vue/multi-word-component-names': 'off',
      'vue/singleline-html-element-content-newline': 'off'
    }
  }
]
