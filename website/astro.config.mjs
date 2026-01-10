// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	vite: {
		plugins: [tailwindcss()],
	},
	integrations: [
		starlight({
			title: 'Code Coach',
			description: 'Explain code you didn\'t write. Plain-English explanations, debugging guidance, and team collaboration for AI-assisted codebases.',
			logo: {
				src: './src/assets/logo.svg',
				replacesTitle: false,
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/yourusername/code-coach' },
			],
			editLink: {
				baseUrl: 'https://github.com/yourusername/code-coach/edit/main/website/',
			},
			customCss: ['./src/styles/global.css'],
			head: [
				{
					tag: 'meta',
					attrs: { property: 'og:image', content: '/og-image.png' },
				},
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Quick Start', slug: 'getting-started/quick-start' },
						{ label: 'Your First Explanation', slug: 'getting-started/first-explanation' },
					],
				},
				{
					label: 'Core Features',
					items: [
						{ label: 'Explain Selection', slug: 'features/explain-selection' },
						{ label: 'Explain Why This Works', slug: 'features/explain-why' },
						{ label: 'Explain Diagnostics', slug: 'features/explain-diagnostics' },
						{ label: 'Deep Dive', slug: 'features/deep-dive' },
						{ label: 'Code Smells', slug: 'features/code-smells' },
						{ label: 'Test Gaps', slug: 'features/test-gaps' },
						{ label: 'Coach Mode', slug: 'features/coach-mode' },
					],
				},
				{
					label: 'Team Intelligence',
					items: [
						{ label: 'Overview', slug: 'team/overview' },
						{ label: 'Explanation Templates', slug: 'team/templates' },
						{ label: 'Team Pinned Symbols', slug: 'team/pins' },
						{ label: 'Explain Diff', slug: 'team/explain-diff' },
						{ label: 'Onboarding Tours', slug: 'team/tours' },
						{ label: 'Change Subscriptions', slug: 'team/subscriptions' },
						{ label: 'Shared Cache', slug: 'team/cache' },
						{ label: 'Knowledge Graph', slug: 'team/graph' },
					],
				},
				{
					label: 'Enterprise',
					items: [
						{ label: 'Overview', slug: 'enterprise/overview' },
						{ label: 'SSO Integration', slug: 'enterprise/sso' },
						{ label: 'Custom Model Endpoints', slug: 'enterprise/endpoints' },
					],
				},
				{
					label: 'Configuration',
					items: [
						{ label: 'AI Providers', slug: 'config/ai-providers' },
						{ label: 'Privacy Modes', slug: 'config/privacy' },
						{ label: 'Team Config', slug: 'config/team-config' },
						{ label: 'Settings Reference', slug: 'config/settings' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'All Commands', slug: 'reference/commands' },
						{ label: 'Keyboard Shortcuts', slug: 'reference/shortcuts' },
					],
				},
			],
		}),
	],
});
