import a_beli_zmaj from "@/assets/tiles/beli-zmaj.png";
import a_card_back from "@/assets/tiles/card-back.png";
import a_crni_zmaj from "@/assets/tiles/crni-zmaj.png";
import a_demon from "@/assets/tiles/demon.png";
import a_duh from "@/assets/tiles/duh.png";
import a_dzin from "@/assets/tiles/dzin.png";
import a_grifon from "@/assets/tiles/grifon.png";
import a_grifon2 from "@/assets/tiles/grifon2.png";
import a_haos from "@/assets/tiles/haos.png";
import a_harpija from "@/assets/tiles/harpija.png";
import a_hidra from "@/assets/tiles/hidra.png";
import a_jednorog from "@/assets/tiles/jednorog.png";
import a_kentaur from "@/assets/tiles/kentaur.png";
import a_konj from "@/assets/tiles/konj.png";
import a_kostur from "@/assets/tiles/kostur.png";
import a_krila from "@/assets/tiles/krila.png";
import a_kristal from "@/assets/tiles/kristal.png";
import a_krokodil from "@/assets/tiles/krokodil.png";
import a_kula from "@/assets/tiles/kula.png";
import a_lav from "@/assets/tiles/lav.png";
import a_letece_cizme from "@/assets/tiles/letece-cizme.png";
import a_ljudozder from "@/assets/tiles/ljudozder.png";
import a_mac from "@/assets/tiles/mac.png";
import a_mag_beli from "@/assets/tiles/mag-beli.png";
import a_mag_crni from "@/assets/tiles/mag-crni.png";
import a_mag_crveni from "@/assets/tiles/mag-crveni.png";
import a_mag_zeleni from "@/assets/tiles/mag-zeleni.png";
import a_magicni_luk from "@/assets/tiles/magicni-luk.png";
import a_medved from "@/assets/tiles/medved.png";
import a_minotaur from "@/assets/tiles/minotaur.png";
import a_moc from "@/assets/tiles/moc.png";
import a_mumija from "@/assets/tiles/mumija.png";
import a_munja from "@/assets/tiles/munja.png";
import a_nebeski_zmaj from "@/assets/tiles/nebeski-zmaj.png";
import a_oklop from "@/assets/tiles/oklop.png";
import a_ork from "@/assets/tiles/ork.png";
import a_pegaz from "@/assets/tiles/pegaz.png";
import a_sablast from "@/assets/tiles/sablast.png";
import a_sekira from "@/assets/tiles/sekira.png";
import a_slepi_mis from "@/assets/tiles/slepi-mis.png";
import a_stit from "@/assets/tiles/stit.png";
import a_trol from "@/assets/tiles/trol.png";
import a_utvara from "@/assets/tiles/utvara.png";
import a_vampir from "@/assets/tiles/vampir.png";
import a_vilenjak from "@/assets/tiles/vilenjak.png";
import a_vlast from "@/assets/tiles/vlast.png";
import a_vuk from "@/assets/tiles/vuk.png";
import a_zid from "@/assets/tiles/zid.png";
import a_zombi from "@/assets/tiles/zombi.png";

export const ART: Record<string, string> = {
  "beli-zmaj": a_beli_zmaj,
  "card-back": a_card_back,
  "crni-zmaj": a_crni_zmaj,
  "demon": a_demon,
  "duh": a_duh,
  "dzin": a_dzin,
  "grifon": a_grifon,
  "grifon2": a_grifon2,
  "haos": a_haos,
  "harpija": a_harpija,
  "hidra": a_hidra,
  "jednorog": a_jednorog,
  "kentaur": a_kentaur,
  "konj": a_konj,
  "kostur": a_kostur,
  "krila": a_krila,
  "kristal": a_kristal,
  "krokodil": a_krokodil,
  "kula": a_kula,
  "lav": a_lav,
  "letece-cizme": a_letece_cizme,
  "ljudozder": a_ljudozder,
  "mac": a_mac,
  "mag-beli": a_mag_beli,
  "mag-crni": a_mag_crni,
  "mag-crveni": a_mag_crveni,
  "mag-zeleni": a_mag_zeleni,
  "magicni-luk": a_magicni_luk,
  "medved": a_medved,
  "minotaur": a_minotaur,
  "moc": a_moc,
  "mumija": a_mumija,
  "munja": a_munja,
  "nebeski-zmaj": a_nebeski_zmaj,
  "oklop": a_oklop,
  "ork": a_ork,
  "pegaz": a_pegaz,
  "sablast": a_sablast,
  "sekira": a_sekira,
  "slepi-mis": a_slepi_mis,
  "stit": a_stit,
  "trol": a_trol,
  "utvara": a_utvara,
  "vampir": a_vampir,
  "vilenjak": a_vilenjak,
  "vlast": a_vlast,
  "vuk": a_vuk,
  "zid": a_zid,
  "zombi": a_zombi,
};

export const artOf = (id: string) => ART[id] ?? ART["moc"];
