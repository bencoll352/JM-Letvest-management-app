import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const variants = cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600', {variants:{variant:{default:'bg-[#075967] text-white hover:bg-[#084854]',outline:'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',ghost:'text-slate-600 hover:bg-slate-100'},size:{default:'h-10 px-4',sm:'h-8 px-3',icon:'h-10 w-10'}},defaultVariants:{variant:'default',size:'default'}});
export function Button({className,variant,size,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof variants>){return <button className={twMerge(clsx(variants({variant,size}),className))} {...props}/>}
