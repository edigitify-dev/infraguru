"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer, viewportMirror } from '@/lib/motion';
import { getNavLocationGroups, type NavLocationItem } from '@/lib/nav-locations';
import { LOCATIONS, FEATURED_LOCATION_SLUG } from '@/lib/locations';
import { FOOTER_DEFAULT_CONTENT, type FooterContent } from '@/lib/pageSections';
import { useSectionEdit } from './pagebuilder/SectionEditBoundary';
import EditableText from './pagebuilder/EditableText';

// Every location starts "Coming Soon" until the real project-availability
// data loads, so the footer never shows a stale/incorrect link.
const FALLBACK_LOCATIONS: NavLocationItem[] = LOCATIONS.map((l) => ({
  slug: l.slug,
  label: l.label,
  href: `/projects/location/${l.slug}`,
  hasProjects: false,
}));

const LINK_COLUMNS = [
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Projects', href: '/projects' },
      { label: 'Gallery', href: '/gallery' },
      { label: 'Careers', href: '/careers' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Services',
    links: [
      { label: 'Property to Buy', href: '/contact' },
      { label: 'Property to Sell', href: '/contact' },
      { label: 'Property to Rent', href: '/contact' },
      { label: 'Joint Development', href: '/contact' },
    ],
  },
];

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  LinkedIn: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
  Instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  ),
  WhatsApp: (
    <svg viewBox="0 0 32 32" fill="currentColor" className="w-4 h-4">
      <path d="M16.004 0C7.164 0 0 7.163 0 16.004c0 2.824.736 5.584 2.135 8.012L.072 32l8.186-2.048A15.92 15.92 0 0016.004 32C24.836 32 32 24.836 32 16.004 32 7.163 24.836 0 16.004 0zm0 29.09a13.06 13.06 0 01-7.072-2.063l-.508-.303-4.858 1.216 1.254-4.734-.332-.527A13.02 13.02 0 012.91 16.004c0-7.222 5.872-13.094 13.094-13.094 7.222 0 13.086 5.872 13.086 13.094 0 7.222-5.864 13.086-13.086 13.086zm7.184-9.806c-.394-.197-2.332-1.15-2.694-1.282-.362-.131-.625-.197-.888.197s-1.02 1.282-1.25 1.545c-.231.263-.462.296-.856.098-.394-.197-1.664-.613-3.17-1.955-1.172-1.044-1.964-2.333-2.195-2.727-.23-.394-.024-.607.174-.803.178-.177.394-.462.591-.692.197-.231.263-.394.394-.657.131-.263.066-.493-.033-.691-.098-.197-.888-2.14-1.217-2.93-.32-.768-.646-.665-.888-.677l-.757-.013c-.263 0-.691.098-1.053.493-.362.394-1.381 1.348-1.381 3.29 0 1.94 1.414 3.815 1.611 4.078.197.263 2.783 4.249 6.741 5.959.942.407 1.677.65 2.25.832.946.3 1.806.258 2.487.157.759-.114 2.332-.954 2.662-1.874.329-.922.329-1.711.23-1.874-.098-.164-.361-.263-.756-.46z" />
    </svg>
  ),
  Facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M22 12.061C22 6.505 17.523 2 12 2S2 6.505 2 12.061c0 5.022 3.657 9.184 8.438 9.939v-7.03H7.898v-2.909h2.54V9.845c0-2.522 1.492-3.915 3.777-3.915 1.094 0 2.238.197 2.238.197v2.476h-1.26c-1.243 0-1.63.775-1.63 1.57v1.888h2.773l-.443 2.909h-2.33V22c4.78-.755 8.437-4.917 8.437-9.939z" />
    </svg>
  ),
};

export default function Footer({ content = FOOTER_DEFAULT_CONTENT }: { content?: FooterContent }) {
  const ctx = useSectionEdit();
  const live = (ctx?.content as FooterContent | undefined) ?? content;
  const [locations, setLocations] = useState<NavLocationItem[]>(FALLBACK_LOCATIONS);

  useEffect(() => {
    let active = true;
    getNavLocationGroups()
      .then((groups) => {
        if (!active) return;
        // Build a lookup of hasProjects by slug from the grouped data
        const projectMap = new Map<string, boolean>();
        groups.forEach((g) => g.items.forEach((item) => projectMap.set(item.slug, item.hasProjects)));
        // Preserve the LOCATIONS array order (not grouped by region)
        setLocations(
          FALLBACK_LOCATIONS.map((loc) => ({
            ...loc,
            hasProjects: projectMap.get(loc.slug) ?? false,
          }))
        );
      })
      .catch(() => {
        // Keep the built-in FALLBACK_LOCATIONS.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <footer id="footer" className="relative overflow-hidden bg-primary-dark text-white">

      {/* Ambient background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-[30%] left-[10%] w-[60vw] h-[60vw] rounded-full bg-white/5 blur-[120px] opacity-50" />
        <div className="absolute -bottom-[20%] right-[5%] w-[40vw] h-[40vw] rounded-full bg-white/5 blur-[100px]" />
      </div>

      {/* Divider */}
      <div className="relative z-10 mx-auto max-w-[1600px] px-5 sm:px-6 lg:px-10 mt-8 sm:mt-16">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Main Footer Grid */}
      <motion.div
        className="relative z-10 container mx-auto max-w-[1600px] px-5 sm:px-6 lg:px-10 py-16 sm:py-24 grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-12 lg:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr_1fr]"
        variants={staggerContainer(0.1)}
        initial="hidden"
        whileInView="visible"
        viewport={viewportMirror}
      >
        {/* Brand Column */}
        <motion.div variants={fadeUp} className="col-span-2 lg:col-span-1">
          <a href="#hero" className="inline-block mb-5 sm:mb-8">
            <Image
              src="/logo.png"
              alt="Infraguru"
              width={180}
              height={58}
              className="h-10 sm:h-14 w-auto object-contain brightness-0 invert"
            />
          </a>
          <EditableText as="p" path="tagline" fallback={live.tagline} multiline className="mb-5 sm:mb-8 max-w-[280px] text-body text-white/70" />
          <div className="flex gap-3">
            {live.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 transition-all duration-300 hover:border-transparent hover:bg-white hover:text-primary-dark hover:-translate-y-0.5"
              >
                {SOCIAL_ICONS[s.label]}
              </a>
            ))}
          </div>
        </motion.div>

        {/* Link Columns */}
        {LINK_COLUMNS.map((col) => (
          <motion.div key={col.title} variants={fadeUp}>
            <h4 className="mb-3 sm:mb-6 text-label font-semibold text-white/50 uppercase">
              {col.title}
            </h4>
            <ul className="flex flex-col gap-2 sm:gap-3">
              {col.links.map((link) =>
                link.href.startsWith('/') ? (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-body text-white/80 transition-all duration-200 hover:text-white hover:translate-x-1 inline-flex items-center gap-2 group"
                    >
                      <span className="w-0 h-px bg-white transition-all duration-200 group-hover:w-3" />
                      {link.label}
                    </Link>
                  </li>
                ) : (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-body text-white/80 transition-all duration-200 hover:text-white hover:translate-x-1 inline-flex items-center gap-2 group"
                    >
                      <span className="w-0 h-px bg-white transition-all duration-200 group-hover:w-3" />
                      {link.label}
                    </a>
                  </li>
                )
              )}
            </ul>
          </motion.div>
        ))}

        {/* Locations Column — reflects which cities/countries actually have published projects */}
        <motion.div variants={fadeUp}>
          <h4 className="mb-3 sm:mb-6 text-label font-semibold text-white/50 uppercase">
            Locations
          </h4>
          <ul className="flex flex-col gap-2 sm:gap-3">
            {locations.map((loc) =>
              loc.hasProjects ? (
                <li key={loc.slug}>
                  <Link
                    href={loc.href}
                    className={`inline-flex items-center gap-2 transition-all duration-200 hover:translate-x-1 group ${
                      loc.slug === FEATURED_LOCATION_SLUG
                        ? 'text-body font-semibold text-gold-gradient'
                        : 'text-body text-white/80 hover:text-white'
                    }`}
                  >
                    <span className={`h-px transition-all duration-200 group-hover:w-3 ${loc.slug === FEATURED_LOCATION_SLUG ? 'w-1.5 bg-gold-gradient' : 'w-0 bg-white'}`} />
                    {loc.label}
                    {loc.slug === FEATURED_LOCATION_SLUG && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gold-gradient opacity-70">
                        Featured
                      </span>
                    )}
                  </Link>
                </li>
              ) : (
                <li key={loc.slug} className="flex items-center gap-2 text-body text-white/40">
                  {loc.label}
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Soon</span>
                </li>
              )
            )}
          </ul>
        </motion.div>

        {/* Contact Column */}
        <motion.div variants={fadeUp} className="col-span-2 lg:col-span-1">
          <h4 className="mb-3 sm:mb-6 text-label font-semibold text-white/50 uppercase">
            Contact
          </h4>
          <ul className="flex flex-col gap-2 sm:gap-3 text-body text-white/80">
            <li>
              <EditableText as="span" path="addressLine1" fallback={live.addressLine1} />
              <br />
              <EditableText as="span" path="addressLine2" fallback={live.addressLine2} />
            </li>
            <li>
              <a href={`mailto:${live.email}`} className="hover:text-white transition-colors">
                <EditableText as="span" path="email" fallback={live.email} />
              </a>
            </li>
            <li>
              <a href={`tel:${live.phone.replace(/\s+/g, "")}`} className="hover:text-white transition-colors">
                <EditableText as="span" path="phone" fallback={live.phone} />
              </a>
            </li>
            <li>
              <a href={live.websiteHref} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                <EditableText as="span" path="websiteLabel" fallback={live.websiteLabel} />
              </a>
            </li>
            <li>
              <EditableText as="span" path="hours" fallback={live.hours} className="text-white/60" />
            </li>
          </ul>
        </motion.div>
      </motion.div>

      {/* Bottom Bar */}
      <div className="relative z-10 border-t border-white/10">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-6 lg:px-10 py-5 sm:py-6 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <span className="text-caption text-white/50">
            © {new Date().getFullYear()} Infraguru. All rights reserved.
          </span>
          <div className="flex items-center gap-5 sm:gap-12 lg:gap-16">
            <a href="#" className="text-caption text-white/50 hover:text-white transition-colors duration-200">
              Privacy Policy
            </a>
            <a href="#" className="text-caption text-white/50 hover:text-white transition-colors duration-200">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
