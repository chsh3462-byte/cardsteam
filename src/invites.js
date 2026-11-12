export function parseRoomAddress(input,origin){
 const raw=String(input||'').trim();if(/^[A-HJ-NP-Z2-9]{8}$/i.test(raw))return raw.toUpperCase();
 try{const u=new URL(raw);if(u.origin!==origin||u.pathname!=='/'||u.username||u.password)return null;const code=u.searchParams.get('room');return /^[A-HJ-NP-Z2-9]{8}$/i.test(code||'')?code.toUpperCase():null;}catch{return null;}
}
export function roomAddress(origin,code){if(!/^[A-HJ-NP-Z2-9]{8}$/.test(code))throw Error('올바르지 않은 방 코드입니다.');const u=new URL('/',origin);u.searchParams.set('room',code);return u.href;}
