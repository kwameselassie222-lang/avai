import { colors } from "./theme";

export const LAYER_META: Record<
  string,
  { name: string; icon: string; color: string; short: string }
> = {
  deep_space:      { name: "Deep Space",      icon: "satellite-variant", color: "#B57BFF", short: "DS" },
  orbital:         { name: "Orbital",         icon: "satellite-uplink",  color: colors.brandPrimary, short: "OR" },
  atmosphere:      { name: "Atmosphere",      icon: "weather-cloudy",    color: "#00FF66", short: "AT" },
  ground:          { name: "Ground",          icon: "shield-home",       color: colors.warning, short: "GD" },
  resource_zones:  { name: "Resource Zones",  icon: "earth",             color: colors.brandSecondary, short: "RZ" },
};

export const LAYER_ORDER = ["deep_space", "orbital", "atmosphere", "ground", "resource_zones"] as const;

export const SHIP_META: Record<string, { icon: string; color: string; label: string }> = {
  scout:     { icon: "airplane",             color: "#8A96A8", label: "Scout" },
  harvester: { icon: "hexagon-multiple",     color: "#FFB020", label: "Harvester" },
  destroyer: { icon: "ufo-outline",          color: colors.brandSecondary, label: "Destroyer" },
  decoy:     { icon: "help-circle-outline",  color: "#4A5468", label: "Decoy" },
  stealth:   { icon: "ghost-outline",        color: "#B57BFF", label: "Stealth" },
  unknown:   { icon: "help-rhombus-outline", color: "#4A5468", label: "Unknown" },
};

export const PROTOCOL_CONDITIONS = [
  { key: "ship_type",         label: "Ship Type",       values: ["scout", "harvester", "destroyer", "decoy", "stealth"] },
  { key: "layer",             label: "Layer",           values: ["deep_space", "orbital", "atmosphere", "ground"] },
  { key: "alien_class",       label: "Alien Class",     values: ["locust", "harvester", "sentinel", "archon"] },
  { key: "viability_below",   label: "Viability Below", values: ["25", "50", "75"] },
  { key: "adaptation_active", label: "Adaptation Live", values: ["REFLECTIVE ARMOR", "ECM JAMMING", "KINETIC DEFLECTORS", "THERMAL SHROUD", "FARADAY MESH", "ACOUSTIC DAMPERS"] },
];

export const PROTOCOL_ACTIONS = [
  { key: "priority", label: "Priority", values: ["max", "high", "normal", "low"] },
  { key: "mode",     label: "Mode",     values: ["attack", "defend", "ignore"] },
];

export const PROTOCOL_COMBINE = ["and", "or"] as const;
