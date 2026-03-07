"use client";

import { useEffect, useState } from "react";

// ── Firecrawl-style ASCII flame texture ───────────────────────────────
// Matches firecrawl.dev: 9px font, 11px leading, rgba(0,0,0,0.2), ~783px wide
const FIRE_TEXTURE_FRAMES = [
  `                                                                                                                                                 
                                                                                                                                                 
                                                                                                                                                 
                                                                                 ...                                                             
                                                                         ......::..                                                              
                                                                           .:..=                                                                 
                                                                            ..                                                                   
                                                              .      ...... ..                                                                   
                                                              ....=..--:+:. . ..                                                                 
                                              .:--:..          ..-=--=-:.... .                          .                                         
                                              ..::--:.         .---==--:: .. .:               .:-::..                                             
                                               ..:--.:         ..---=-=--::....-=....         . .:::....:..                                       
                                                .:--::.          .:-===-:::=.. ..:-::-:..      ..:::- .....                                       
                                  ..-     .  .  ..==-:...        ..-=+=-:-...  ..==++-::.   .   ::-::..-...         .....                         
                                 .::::     ..   .:+=-::.  ..     .-=++=-:...   .:---=-::+......:.:X--:..:.....= ....:--::.                        
                         .........-::::..:+::.. ..-==::.-..     .:===++=- ...  :-:--==-::...  .::-+==::...::-:..-..:----:..                       
                  .:.=. ..:--+=-----:::....:.    .::=+-.=.      ::::--+=-:: ..:-::-==+-:.     :.::-++= --::-+X=-=----=---:.. ....                 
          .-...  .:::: ..:=+XX++==+=:.:.....     ..:-++::::.-.  .:::--=XX==-::::.:--+X-:.    .:.: :-=X=--:::-=+= ==--==+--:.-..::..   ...=.      
         ........::=-::..:-++XX++-+=--:.-.       .:-++++-:.:--..::::--=+XXX+=--::-+--==-:. .::.::: :-=+--::-=+X+-+==:==+=-::::-::...  . ....     
        .+..::::-:---:-:::-+ XXXX++==+-::...=. .::-+X ===-::::-------==++X.XX+==--=---=+=:..:..::::--==+=--+XXXXX+=====++=-==----::...:.::.:.    
         .:.::--=====++====XXXXXXX+==+==+=-:::::-==++==++==--=::--==++==+XXX-XX++.======X+-::.::=-=++==++++XXXXXXX+==-=+=++ ++==----::::::::.=.  
     ..  ..::-===+==++XX+XXXXXXXXX++=++X+X+=-=== +=++=++XX:==---=+++++++=+++XXXX++=====-+XX==-===-+X==++XXXXXXXXXX+=-==++X+X+-+===+=-----::....  `,
  `                                                                                                                                                 
                                                                                                                                                 
                                                                                                                                                 
                                                                                  ...                                                            
                                                                          ......::..                                                             
                                                                            .:..=                                                                
                                                                             ..                                                                  
                                                               .      ...... ..                                                                  
                                                               ....=..--:+:. . ..                                                                
                                               .:--:..          ..-=--=-:.... .                          .                                        
                                               ..::--:.         .---==--:: .. .:               .:-::..                                            
                                                ..:--.:         ..---=-=--::....-=....         . .:::....:..                                      
                                                 .:--::.          .:-===-:::=.. ..:-::-:..      ..:::- .....                                      
                                   ..-     .  .  ..==-:...        ..-=+=-:-...  ..==++-::.   .   ::-::..-...         .....                        
                                  .::::     ..   .:+=-::.  ..     .-=++=-:...   .:---=-::+......:.:X--:..:.....= ....:--::.                       
                          .........-::::..:+::.. ..-==::.-..     .:===++=- ...  :-:--==-::...  .::-+==::...::-:..-..:----:..                      
                   .:.=. ..:--+=-----:::....:.    .::=+-.=.      ::::--+=-:: ..:-::-==+-:.     :.::-++= --::-+X=-=----=---:.. ....                
           .-...  .:::: ..:=+XX++==+=:.:.....     ..:-++::::.-.  .:::--=XX==-::::.:--+X-:.    .:.: :-=X=--:::-=+= ==--==+--:.-..::..   ...=.     
          ........::=-::..:-++XX++-+=--:.-.       .:-++++-:.:--..::::--=+XXX+=--::-+--==-:. .::.::: :-=+--::-=+X+-+==:==+=-::::-::...  . ....    
         .+..::::-:---:-:::-+ XXXX++==+-::...=. .::-+X ===-::::-------==++X.XX+==--=---=+=:..:..::::--==+=--+XXXXX+=====++=-==----::...:.::.:.   
          .:.::--=====++====XXXXXXX+==+==+=-:::::-==++==++==--=::--==++==+XXX-XX++.======X+-::.::=-=++==++++XXXXXXX+==-=+=++ ++==----::::::::.=. 
      ..  ..::-===+==++XX+XXXXXXXXX++=++X+X+=-=== +=++=++XX:==---=+++++++=+++XXXX++=====-+XX==-===-+X==++XXXXXXXXXX+=-==++X+X+-+===+=-----::.... `,
  `                                                                                                                                                 
                                                                                                                                                 
                                                                                                                                                 
                                                                                ...                                                              
                                                                        ......::..                                                               
                                                                          .:..=                                                                  
                                                                           ..                                                                    
                                                             .      ...... ..                                                                    
                                                             ....=..--:+:. . ..                                                                  
                                             .:--:..          ..-=--=-:.... .                          .                                          
                                             ..::--:.         .---==--:: .. .:               .:-::..                                              
                                              ..:--.:         ..---=-=--::....-=....         . .:::....:..                                        
                                               .:--::.          .:-===-:::=.. ..:-::-:..      ..:::- .....                                        
                                 ..-     .  .  ..==-:...        ..-=+=-:-...  ..==++-::.   .   ::-::..-...         .....                        
                                .::::     ..   .:+=-::.  ..     .-=++=-:...   .:---=-::+......:.:X--:..:.....= ....:--::.                         
                        .........-::::..:+::.. ..-==::.-..     .:===++=- ...  :-:--==-::...  .::-+==::...::-:..-..:----:..                        
                 .:.=. ..:--+=-----:::....:.    .::=+-.=.      ::::--+=-:: ..:-::-==+-:.     :.::-++= --::-+X=-=----=---:.. ....                  
         .-...  .:::: ..:=+XX++==+=:.:.....     ..:-++::::.-.  .:::--=XX==-::::.:--+X-:.    .:.: :-=X=--:::-=+= ==--==+--:.-..::..   ...=.       
        ........::=-::..:-++XX++-+=--:.-.       .:-++++-:.:--..::::--=+XXX+=--::-+--==-:. .::.::: :-=+--::-=+X+-+==:==+=-::::-::...  . ....      
       .+..::::-:---:-:::-+ XXXX++==+-::...=. .::-+X ===-::::-------==++X.XX+==--=---=+=:..:..::::--==+=--+XXXXX+=====++=-==----::...:.::.:.     
        .:.::--=====++====XXXXXXX+==+==+=-:::::-==++==++==--=::--==++==+XXX-XX++.======X+-::.::=-=++==++++XXXXXXX+==-=+=++ ++==----::::::::.=.   
    ..  ..::-===+==++XX+XXXXXXXXX++=++X+X+=-=== +=++=++XX:==---=+++++++=+++XXXX++=====-+XX==-===-+X==++XXXXXXXXXX+=-==++X+X+-+===+=-----::....   `,
];

// ── Animated side ASCII art frames (small orange blocks, firecrawl style) ──
const SIDE_ASCII_FRAMES = [
  `  <++++>
 ++XXXXX++
 +XXXXXXX+
X+XXXXX+X+
 +XXXXXXX+
 ++XXXXX++
  <++++>`,
  `  <++*+>
 +*XXXXX++
 +XXXX*XX+
X+XXXXX+X+
 +XX*XXXX+
 ++XXXXX*+
  <+*++>`,
  `  <*+++>
 ++XXX*X++
 +XXXXXXX+
X*XXXXX+X*
 +XXXXXXX+
 ++X*XXX++
  <+++*>`,
];

const BRAILLE_SPINNER_FRAMES = [
  "\u28FE",
  "\u28FD",
  "\u28FB",
  "\u28BF",
  "\u287F",
  "\u28DF",
  "\u28EF",
  "\u28F7",
];

// ── Braille spinner ───────────────────────────────────────────────────
export function BrailleSpinner({ style }: { style?: React.CSSProperties }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % BRAILLE_SPINNER_FRAMES.length), 80);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ fontFamily: "var(--font-geist-mono), monospace", ...style }}
    >
      {BRAILLE_SPINNER_FRAMES[i]}
    </span>
  );
}

export function AnimatedLandingDecor() {
  const [flameFrame, setFlameFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFlameFrame((p) => (p + 1) % FIRE_TEXTURE_FRAMES.length), 85);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 8,
          lineHeight: "10px",
          color: "#fa5d19",
          opacity: 0.3,
          whiteSpace: "pre",
          fontFamily: "var(--font-geist-mono), monospace",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 2,
        }}
      >
        {SIDE_ASCII_FRAMES[flameFrame % SIDE_ASCII_FRAMES.length]}
      </div>
      <div
        style={{
          position: "fixed",
          right: 16,
          top: "50%",
          transform: "translateY(-50%) scaleX(-1)",
          fontSize: 8,
          lineHeight: "10px",
          color: "#fa5d19",
          opacity: 0.3,
          whiteSpace: "pre",
          fontFamily: "var(--font-geist-mono), monospace",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 2,
        }}
      >
        {SIDE_ASCII_FRAMES[(flameFrame + 1) % SIDE_ASCII_FRAMES.length]}
      </div>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: -280,
          width: 783,
          height: 160,
          zIndex: 1,
          pointerEvents: "none",
          userSelect: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontSize: 9,
            lineHeight: "11px",
            color: "rgba(0,0,0,0.18)",
            whiteSpace: "pre",
            fontFamily: "'Roboto Mono', var(--font-geist-mono), monospace",
            position: "absolute",
            bottom: 0,
            left: 0,
          }}
        >
          {FIRE_TEXTURE_FRAMES[flameFrame]}
        </div>
      </div>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          right: -280,
          width: 783,
          height: 160,
          zIndex: 1,
          pointerEvents: "none",
          userSelect: "none",
          overflow: "hidden",
          transform: "scaleX(-1)",
        }}
      >
        <div
          style={{
            fontSize: 9,
            lineHeight: "11px",
            color: "rgba(0,0,0,0.18)",
            whiteSpace: "pre",
            fontFamily: "'Roboto Mono', var(--font-geist-mono), monospace",
            position: "absolute",
            bottom: 0,
            left: 0,
          }}
        >
          {FIRE_TEXTURE_FRAMES[flameFrame]}
        </div>
      </div>
    </>
  );
}
