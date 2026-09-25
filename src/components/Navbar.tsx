"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getNavLocationGroups, type NavLocationGroup } from '@/lib/nav-locations';
import { LOCATIONS, FEATURED_LOCATION_SLUG } from '@/lib/locations';

type NavLink = { href: string; label: string };

const LINKS: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  // { href: '/projects', label: 'Projects' },
];

// Rendered right after the Properties dropdown (both desktop and mobile),
// not part of LINKS — Gallery needs to sit after Properties, not in the
// plain alphabetical/registration order the LINKS array implies.
const GALLERY_LINK: NavLink = { href: '/gallery', label: 'Gallery' };

// Rendered until the real project-availability data loads — every location
// starts as "Coming Soon" rather than guessing, so the dropdown never shows
// a stale/incorrect link.
const FALLBACK_LOCATION_GROUPS: NavLocationGroup[] = [
  {
    heading: 'India',
    items: LOCATIONS.filter((l) => l.region === 'India').map((l) => ({
      slug: l.slug,
      label: l.label,
      href: `/projects/location/${l.slug}`,
      hasProjects: false,
    })),
  },
  {
    heading: 'International',
    items: LOCATIONS.filter((l) => l.region === 'International').map((l) => ({
      slug: l.slug,
      label: l.label,
      href: `/projects/location/${l.slug}`,
      hasProjects: false,
    })),
  },
];

type NavbarProps = {
  /** Forces the solid/blurred bar look from the start — for pages without a
   * full-bleed dark hero behind the fixed header, where the default
   * transparent-until-scrolled state would leave white nav text unreadable. */
  solid?: boolean;
};

export default function Navbar({ solid = false }: NavbarProps = {}) {
  const pathname = usePathname();
  const isActivePath = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const propertiesActive = pathname.startsWith('/projects');
  const [scrolled, setScrolled] = useState(false);
  const isSolid = solid || scrolled;
  const [menuOpen, setMenuOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [mobilePropertiesOpen, setMobilePropertiesOpen] = useState(false);
  const [locationGroups, setLocationGroups] = useState<NavLocationGroup[]>(FALLBACK_LOCATION_GROUPS);

  useEffect(() => {
    let active = true;
    getNavLocationGroups()
      .then((groups) => {
        if (active) setLocationGroups(groups);
      })
      .catch(() => {
        // Keep the built-in FALLBACK_LOCATION_GROUPS.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let ticking = false;
    const checkScrolled = () => {
      setScrolled((prev) => {
        const next = window.scrollY > 40;
        return prev === next ? prev : next;
      });
      ticking = false;
    };
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(checkScrolled);
    };
    checkScrolled();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -80 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-[100] flex justify-center"
    >
      {/* Capsule shell — morphs from an edge-to-edge bar into a floating pill as the page scrolls */}
      <motion.div
        animate={{
          marginTop: scrolled ? 14 : 0,
          width: scrolled ? '94%' : '100%',
          maxWidth: scrolled ? 1340 : 2400,
          borderRadius: scrolled ? 999 : 0,
          backgroundColor: isSolid ? 'rgba(255,255,255,0.92)' : 'rgba(11,19,32,0)',
          borderColor: isSolid ? 'rgba(3,46,151,0.08)' : 'rgba(255,255,255,0)',
          boxShadow: isSolid ? '0 20px 45px rgba(3,46,151,0.15)' : '0 0px 0px rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={`w-full border transition-[backdrop-filter] duration-700 ${isSolid ? 'backdrop-blur-xl' : 'backdrop-blur-0'}`}
      >
        <div className="container mx-auto px-5 sm:px-8 grid grid-cols-2 min-[901px]:grid-cols-3 items-center py-2.5 sm:py-3 lg:py-4">
          {/* Left: Logo */}
          <div className="flex justify-start">
            <Link href="/" className="inline-flex items-center shrink-0 z-10">
              <Image
                src="/logo.png"
                alt="Infraguru"
                width={280}
                height={90}
                className={`object-contain transition-all duration-500 h-12 sm:h-[4.25rem] w-auto ${isSolid ? '' : 'brightness-0 invert'}`}
                priority
              />
            </Link>
          </div>

          {/* Center: Desktop Links */}
          <div className="hidden min-[901px]:flex justify-center items-center gap-1">
            {LINKS.map((link) => {
              const active = isActivePath(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative px-3 py-2.5 text-[15px] font-semibold tracking-[0.06em] uppercase transition-all duration-300 rounded-lg ${isSolid ? 'text-primary-dark hover:bg-primary/8' : 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] hover:bg-white/10'}`}
                >
                  {link.label}
                  <span
                    className={`pointer-events-none absolute inset-x-5 -bottom-0.5 h-[2px] origin-center rounded-full bg-secondary shadow-[0_0_6px_rgba(212,175,55,0.6)] transition-transform duration-300 ease-out group-hover:scale-x-100 ${active ? 'scale-x-100' : 'scale-x-0'}`}
                  />
                </Link>
              );
            })}

            {/* Properties dropdown — driven by which locations actually have published projects */}
            <div
              className="relative"
              onMouseEnter={() => setPropertiesOpen(true)}
              onMouseLeave={() => setPropertiesOpen(false)}
            >
              <button
                type="button"
                onClick={() => setPropertiesOpen((v) => !v)}
                aria-expanded={propertiesOpen}
                aria-current={propertiesActive ? 'page' : undefined}
                className={`group relative flex items-center gap-1.5 px-3 py-2.5 text-[15px] font-semibold tracking-[0.06em] uppercase transition-all duration-300 rounded-lg ${isSolid ? 'text-primary-dark hover:bg-primary/8' : 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] hover:bg-white/10'}`}
              >
                Properties
                <svg
                  className={`w-3 h-3 transition-transform duration-300 ${propertiesOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
                <span
                  className={`pointer-events-none absolute inset-x-5 -bottom-0.5 h-[2px] origin-center rounded-full bg-secondary shadow-[0_0_6px_rgba(212,175,55,0.6)] transition-transform duration-300 ease-out group-hover:scale-x-100 ${propertiesActive ? 'scale-x-100' : 'scale-x-0'}`}
                />
              </button>

              <AnimatePresence>
                {propertiesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-1/2 top-full mt-2 w-100 -translate-x-1/2 grid grid-cols-2 gap-6 rounded-2xl border border-white/10 bg-[#0B1320]/95 backdrop-blur-2xl p-5 shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
                  >
                    {locationGroups.map((group) => (
                      <div key={group.heading}>
                        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gold-gradient">
                          {group.heading}
                        </p>
                        <ul className="flex flex-col gap-1">
                          {group.items.map((item) =>
                            item.hasProjects ? (
                              <li key={item.slug}>
                                <Link
                                  href={item.href}
                                  onClick={() => setPropertiesOpen(false)}
                                  className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-200 ${
                                    item.slug === FEATURED_LOCATION_SLUG
                                      ? 'font-semibold text-gold-gradient hover:brightness-110'
                                      : 'text-white/75 hover:text-white hover:bg-white/10'
                                  }`}
                                >
                                  {item.label}
                                  {item.slug === FEATURED_LOCATION_SLUG && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-gold-gradient opacity-70">
                                      Featured
                                    </span>
                                  )}
                                </Link>
                              </li>
                            ) : (
                              <li key={item.slug}>
                                <span className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-white/35 cursor-not-allowed">
                                  {item.label}
                                  <span className="text-[8px] font-bold uppercase tracking-wider text-white/25">Soon</span>
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link
              href={GALLERY_LINK.href}
              aria-current={isActivePath(GALLERY_LINK.href) ? 'page' : undefined}
              className={`group relative px-3 py-2.5 text-[15px] font-semibold tracking-[0.06em] uppercase transition-all duration-300 rounded-lg ${isSolid ? 'text-primary-dark hover:bg-primary/8' : 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] hover:bg-white/10'}`}
            >
              {GALLERY_LINK.label}
              <span
                className={`pointer-events-none absolute inset-x-5 -bottom-0.5 h-[2px] origin-center rounded-full bg-secondary shadow-[0_0_6px_rgba(212,175,55,0.6)] transition-transform duration-300 ease-out group-hover:scale-x-100 ${isActivePath(GALLERY_LINK.href) ? 'scale-x-100' : 'scale-x-0'}`}
              />
            </Link>

            <Link
              href="/careers"
              aria-current={isActivePath('/careers') ? 'page' : undefined}
              className={`group relative px-3 py-2.5 text-[15px] font-semibold tracking-[0.06em] uppercase transition-all duration-300 rounded-lg ${isSolid ? 'text-primary-dark hover:bg-primary/8' : 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] hover:bg-white/10'}`}
            >
              Careers
              <span
                className={`pointer-events-none absolute inset-x-5 -bottom-0.5 h-[2px] origin-center rounded-full bg-secondary shadow-[0_0_6px_rgba(212,175,55,0.6)] transition-transform duration-300 ease-out group-hover:scale-x-100 ${isActivePath('/careers') ? 'scale-x-100' : 'scale-x-0'}`}
              />
            </Link>
          </div>

          {/* Right: Desktop CTA & Mobile Hamburger */}
          <div className="flex justify-end items-center">
            <Link
              href="/contact"
              className={`hidden min-[901px]:inline-flex items-center gap-3 px-6 py-2.5 text-[13px] font-bold uppercase tracking-widest transition-all duration-500 ${isSolid
                ? 'rounded-full border border-transparent bg-gold-gradient text-primary-dark hover:brightness-110'
                : 'rounded-[4px] border border-white/50 bg-black/10 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] backdrop-blur-sm hover:bg-white hover:text-black hover:border-white'
                }`}
            >
              BOOK A CONSULTATION
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 17L17 7m0 0H8m9 0v9" /></svg>
            </Link>

            <button
              className="z-[110] flex h-10 w-10 flex-col items-center justify-center gap-[5px] min-[901px]:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <span className={`block h-[1.5px] w-6 transition-all duration-300 origin-center ${isSolid ? 'bg-primary-dark' : 'bg-white'} ${menuOpen ? 'translate-y-[6.5px] rotate-45' : ''}`} />
              <span className={`block h-[1.5px] w-6 transition-all duration-300 ${isSolid ? 'bg-primary-dark' : 'bg-white'} ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
              <span className={`block h-[1.5px] w-6 transition-all duration-300 origin-center ${isSolid ? 'bg-primary-dark' : 'bg-white'} ${menuOpen ? '-translate-y-[6.5px] -rotate-45' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-4 top-full mt-2 flex flex-col gap-1.5 rounded-[24px] border border-white/10 bg-[#0B1320]/95 backdrop-blur-3xl p-6 shadow-[0_40px_80px_rgba(0,0,0,0.6)] min-[901px]:hidden"
            >
              {LINKS.map((link) => {
                const active = isActivePath(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex items-center justify-between px-4 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all duration-300 ${active ? 'text-gold-gradient bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
                  >
                    {link.label}
                    <span className={`text-lg font-light transition-colors ${active ? 'text-gold-gradient' : 'text-white/30 group-hover:text-gold-gradient'}`}>
                      {active ? '•' : '→'}
                    </span>
                  </Link>
                );
              })}

              {/* Properties dropdown — driven by which locations actually have published projects */}
              <div className="rounded-2xl">
                <button
                  type="button"
                  onClick={() => setMobilePropertiesOpen((v) => !v)}
                  aria-expanded={mobilePropertiesOpen}
                  aria-current={propertiesActive ? 'page' : undefined}
                  className={`group flex w-full items-center justify-between px-4 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all duration-300 ${propertiesActive ? 'text-gold-gradient bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
                >
                  Properties
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-300 ${propertiesActive ? 'text-gold-gradient' : 'text-white/40'} ${mobilePropertiesOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {mobilePropertiesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-4 px-4 pb-3 pt-1">
                        {locationGroups.map((group) => (
                          <div key={group.heading}>
                            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gold-gradient">
                              {group.heading}
                            </p>
                            <ul className="flex flex-col gap-0.5">
                              {group.items.map((item) =>
                                item.hasProjects ? (
                                  <li key={item.slug}>
                                    <Link
                                      href={item.href}
                                      onClick={() => { setMenuOpen(false); setMobilePropertiesOpen(false); }}
                                      className={`flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs font-medium transition-colors duration-200 ${
                                        item.slug === FEATURED_LOCATION_SLUG
                                          ? 'font-bold text-gold-gradient'
                                          : 'text-white/70 hover:text-white hover:bg-white/5'
                                      }`}
                                    >
                                      {item.label}
                                      {item.slug === FEATURED_LOCATION_SLUG && (
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-gold-gradient opacity-70">
                                          Featured
                                        </span>
                                      )}
                                    </Link>
                                  </li>
                                ) : (
                                  <li key={item.slug}>
                                    <span className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-xs font-medium text-white/35 cursor-not-allowed">
                                      {item.label}
                                      <span className="text-[8px] font-bold uppercase tracking-wider text-white/25">Soon</span>
                                    </span>
                                  </li>
                                )
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link
                href={GALLERY_LINK.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActivePath(GALLERY_LINK.href) ? 'page' : undefined}
                className={`group flex items-center justify-between px-4 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all duration-300 ${isActivePath(GALLERY_LINK.href) ? 'text-gold-gradient bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
              >
                {GALLERY_LINK.label}
                <span className={`text-lg font-light transition-colors ${isActivePath(GALLERY_LINK.href) ? 'text-gold-gradient' : 'text-white/30 group-hover:text-gold-gradient'}`}>
                  {isActivePath(GALLERY_LINK.href) ? '•' : '→'}
                </span>
              </Link>

              <Link
                href="/careers"
                onClick={() => setMenuOpen(false)}
                aria-current={isActivePath('/careers') ? 'page' : undefined}
                className={`group flex items-center justify-between px-4 py-4 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all duration-300 ${isActivePath('/careers') ? 'text-gold-gradient bg-white/5' : 'text-white/80 hover:text-white hover:bg-white/5'}`}
              >
                Careers
                <span className={`text-lg font-light transition-colors ${isActivePath('/careers') ? 'text-gold-gradient' : 'text-white/30 group-hover:text-gold-gradient'}`}>
                  {isActivePath('/careers') ? '•' : '→'}
                </span>
              </Link>
              <Link
                href="/contact"
                className="mt-4 flex w-full items-center justify-center rounded-full bg-gold-gradient py-4 text-center text-[13px] font-bold text-[#132731] uppercase tracking-widest shadow-[0_10px_30px_rgba(212,175,55,0.2)] transition-all duration-300 hover:brightness-110 hover:shadow-[0_15px_40px_rgba(212,175,55,0.3)]"
                onClick={() => setMenuOpen(false)}
              >
                BOOK A CONSULTATION
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.header>
  );
}
