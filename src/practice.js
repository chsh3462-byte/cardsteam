import {createGame,applyAction,PRESETS} from './core.js';
export function createPractice(){
 const state=createGame({name:'나 · 연습',deck:PRESETS[1].cards},{name:'연습 상대',deck:PRESETS[1].cards},()=>0);
 const p=state.players[0];
 if(!p.hand.some(h=>h.id===1)){const i=p.deck.indexOf(1);[p.hand[0].id,p.deck[i]]=[p.deck[i],p.hand[0].id];}
 return {state,step:0,now:10000};
}
export function advancePractice(practice){
 let {state,step,now}=practice;if(step>=11)return practice;
 now+=3000;const p=state.players[0],uid=p.field[0]?.uid;
 const actions=[{type:'draw',pick:0},{type:'play',uid:p.hand.find(h=>h.id===1)?.uid},{type:'roll'},{type:'bind',uid,slot:0,dieIndex:0},{type:'stance',uid,stance:'guard'},{type:'end'},{type:'draw',pick:0},{type:'roll'},{type:'bind',uid,slot:0,dieIndex:0},{type:'stance',uid,stance:'strike'},{type:'attack',uid,target:'core'}];
 let i=0;state=applyAction(state,0,actions[step],()=>[4,3,2,1,0][i++%5],now);
 if(step===5){state=applyAction(state,1,{type:'draw',pick:0},()=>0,now);state=applyAction(state,1,{type:'end'},()=>0,now);}
 return {state,step:step+1,now};
}
