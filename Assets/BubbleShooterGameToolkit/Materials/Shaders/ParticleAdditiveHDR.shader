Shader "Custom/ParticleAdditiveHDR" {
    Properties {
        _MainTex ("Particle Texture", 2D) = "white" {}
        _TintColor ("Tint Color", Color) = (1,1,1,1)
        _HDRIntensity("HDR Intensity", Range(0.1, 5)) = 1.0
    }
    SubShader {
        Tags { "Queue"="Transparent" "IgnoreProjector"="True" "RenderType"="Transparent" }
        LOD 300
        Pass {
            ZWrite Off
            Blend One One
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            struct appdata_t {
                float4 vertex : POSITION;
                fixed4 color : COLOR;
                float2 texcoord : TEXCOORD0;
            };
            struct v2f {
                float2 texcoord : TEXCOORD0;
                fixed4 color : COLOR;
                float4 vertex : SV_POSITION;
            };
            fixed4 _TintColor;
            float _HDRIntensity;
            sampler2D _MainTex;
            v2f vert(appdata_t v) {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.texcoord = v.texcoord;
                o.color = v.color * _TintColor;
                return o;
            }
            fixed4 frag(v2f i) : SV_Target {
                fixed4 col = i.color * tex2D(_MainTex, i.texcoord);
                col.rgb *= _HDRIntensity; // Apply HDR intensity
                return col;
            }
            ENDCG
        }
    }
}