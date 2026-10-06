#target illustrator

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.CurledLine
Version=1.0.0
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=くるっとした線
Author=Murakami Yoshiteru
Release-Date=2026-10-06
Target-App=Illustrator
Description-BEGIN
3つのアンカーを持つ開いたパスを、途中で交差して輪を作る一本の線に変形します。
アンカーを開始点・輪の中心・終了点の順に配置し、パスを1本選択して実行してください。

輪の幅、線幅、巻く方向、巻きの角度、開始側と終了側の曲がり具合を調整できます。
プレビューに対応し、キャンセルすると元のパスに戻ります。
Description-END
SCRIPTMETA-END
*/

// CurledLine 1.0.0 — Illustrator / ExtendScript
(function () {
    var MM = 72 / 25.4;
    function add(a,b){return [a[0]+b[0],a[1]+b[1]];}
    function sub(a,b){return [a[0]-b[0],a[1]-b[1]];}
    function mul(a,s){return [a[0]*s,a[1]*s];}
    function len(a){return Math.sqrt(a[0]*a[0]+a[1]*a[1]);}
    function dot(a,b){return a[0]*b[0]+a[1]*b[1];}
    function copy(a){return [a[0],a[1]];}
    function node(p,l,r){return {a:p,l:l||copy(p),r:r||copy(p)};}
    function geometry(a,c,b,width,outer,startBend,endBend,curlAngle){
        var u=mul(sub(b,a),1/len(sub(b,a))), n=[-u[1],u[0]];
        if(dot(sub(c,a),n)<0)n=mul(n,-1);
        if(outer)n=mul(n,-1);
        var r=width/2, k=0.5522847498;
        function p(x,y){return add(c,add(mul(u,x*r),mul(n,y*r)));}
        // 内側では、輪の中心より外側の位置で前後の線につなぐ。
        var x=p(0,1), left=p(-1,0), bottom=p(0,-1), right=p(1,0);
        var halfAngle=curlAngle*Math.PI/360, cosine=Math.cos(halfAngle), sine=Math.sin(halfAngle);
        var enter=sub(mul(u,cosine),mul(n,sine)), leave=add(mul(u,cosine),mul(n,sine));
        var ha=len(sub(x,a))*startBend/3, hb=len(sub(b,x))*endBend/3;
        var va=mul(sub(x,a),1/len(sub(x,a))), vb=mul(sub(b,x),1/len(sub(b,x)));
        // 各端点と接続点を結ぶ方向に対して接線を反転し、S字の曲がりを避ける。
        var da=sub(mul(va,2*dot(va,enter)),enter), db=sub(mul(vb,2*dot(vb,leave)),leave);
        // 同じ接続位置で入口と出口の接線を傾け、指定した角度で交差させる。
        return [
            node(copy(a),copy(a),add(a,mul(da,ha))),
            node(x,sub(x,mul(enter,ha)),add(x,mul(enter,r*k))),
            node(right,p(1,k),p(1,-k)),
            node(bottom,p(k,-1),p(-k,-1)),
            node(left,p(-1,-k),p(-1,k)),
            node(copy(x),sub(x,mul(leave,r*k)),add(x,mul(leave,hb))),
            node(copy(b),sub(b,mul(db,hb)),copy(b))
        ];
    }
    if(app.documents.length===0){alert('ドキュメントを開いてください。');return;}
    var doc=app.activeDocument, sel=doc.selection;
    if(!sel || sel.length!==1 || sel[0].typename!=='PathItem'){
        alert('3つのアンカーを持つ、一本の開いたパスを選択してください。');return;
    }
    var path=sel[0];
    if(path.closed || path.pathPoints.length!==3 || path.guides || path.clipping || !path.editable){
        alert('編集可能な、3アンカーの開いた通常パスを選択してください。');return;
    }
    var saved=[],i;
    for(i=0;i<3;i++){
        var q=path.pathPoints[i];
        saved.push({a:copy(q.anchor),l:copy(q.leftDirection),r:copy(q.rightDirection),type:q.pointType,selected:q.selected});
    }
    var a=saved[0].a,c=saved[1].a,b=saved[2].a, base=sub(b,a), distance=len(base);
    if(distance<0.01 || len(sub(c,a))<0.01 || len(sub(b,c))<0.01){
        alert('開始点・中心点・終了点を別の位置に置いてください。');return;
    }
    var height=Math.abs(dot(sub(c,a),[-base[1]/distance,base[0]/distance]));
    if(height<0.01){alert('中心点を、開始点と終了点を結ぶ直線から離してください。');return;}
    var original={stroked:path.stroked,filled:path.filled,width:path.strokeWidth,color:path.strokeColor};
    var accepted=false,changed=false;
    function write(points,restore){
        var anchors=[],j;
        for(j=0;j<points.length;j++)anchors.push(copy(points[j].a));
        path.setEntirePath(anchors);
        for(j=0;j<points.length;j++){
            var pt=path.pathPoints[j];
            pt.leftDirection=copy(points[j].l);pt.rightDirection=copy(points[j].r);
            pt.pointType=restore?points[j].type:PointType.SMOOTH;
            if(restore)pt.selected=points[j].selected;
        }
    }
    function restore(){
        if(!changed)return;
        write(saved,true);path.stroked=original.stroked;path.filled=original.filled;
        path.strokeWidth=original.width;
        if(original.stroked)path.strokeColor=original.color;
        changed=false;app.redraw();
    }
    var win=new Window('dialog','くるっとした線');win.orientation='column';win.alignChildren='fill';
    var panel=win.add('panel',undefined,'形と線幅');panel.orientation='column';panel.alignChildren='fill';
    function field(label,value,step,minimum,maximum){
        var row=panel.add('group');row.add('statictext',undefined,label).preferredSize.width=160;
        var edit=row.add('edittext',undefined,value);edit.characters=8;
        if(step){
            var minus=row.add('button',undefined,'−'),plus=row.add('button',undefined,'＋');
            minus.preferredSize.width=32;plus.preferredSize.width=32;
            function increment(delta){
                var v=Number(edit.text);if(!isFinite(v))return;
                var next=Math.max(minimum===undefined?step:minimum,Math.round((v+delta)*10)/10);
                if(maximum!==undefined)next=Math.min(maximum,next);
                edit.text=next.toFixed(1);update();
            }
            minus.onClick=function(){increment(-step);};plus.onClick=function(){increment(step);};
        }
        edit.onChange=function(){update();};return edit;
    }
    var size=field('輪の幅（mm）',Math.max(0.1,Math.round(Math.min(height,distance/4)/MM*10)/10).toFixed(1),0.1);
    var weight=field('線幅（mm）',Math.max(0.1,Math.round((original.stroked?original.width/MM:0.3)*10)/10).toFixed(1),0.1);
    var directionRow=panel.add('group');directionRow.add('statictext',undefined,'巻く方向').preferredSize.width=160;
    var direction=directionRow.add('dropdownlist',undefined,['内側','外側']);direction.selection=0;direction.onChange=function(){update();};
    var curl=field('巻きの角度（°）','0',5,0,90);
    var start=field('開始側の曲がり具合（%）','100',null);
    var end=field('終了側の曲がり具合（%）','100',null);
    var preview=win.add('checkbox',undefined,'プレビュー');preview.value=true;
    var message=win.add('statictext',undefined,'',{multiline:true});message.preferredSize=[390,38];
    var buttons=win.add('group');buttons.alignment='right';
    var reset=buttons.add('button',undefined,'自動値に戻す');
    var cancel=buttons.add('button',undefined,'キャンセル',{name:'cancel'});
    var ok=buttons.add('button',undefined,'確定',{name:'ok'});
    function values(){
        var v={size:Number(size.text),weight:Number(weight.text),curl:Number(curl.text),start:Number(start.text),end:Number(end.text)};
        if(!isFinite(v.size)||v.size<=0||!isFinite(v.weight)||v.weight<0.1)throw Error('輪の幅は正の数、線幅は0.1mm以上で指定してください。');
        if(!isFinite(v.curl)||v.curl<0||v.curl>90)throw Error('巻きの角度は0〜90°で指定してください。');
        if(!isFinite(v.start)||v.start<10||v.start>300||!isFinite(v.end)||v.end<10||v.end>300)throw Error('曲がり具合は10〜300%で指定してください。');
        return v;
    }
    function apply(v){
        changed=true;
        write(geometry(a,c,b,v.size*MM,direction.selection.index===1,v.start/100,v.end/100,v.curl),false);
        path.filled=false;path.stroked=true;path.strokeWidth=Math.round(v.weight*10)/10*MM;
        if(!original.stroked){var black=new GrayColor();black.gray=100;path.strokeColor=black;}
        app.redraw();
    }
    function update(){
        try{var v=values();if(preview.value)apply(v);else restore();message.text='';ok.enabled=true;}
        catch(e){message.text=e.message;ok.enabled=false;}
    }
    preview.onClick=function(){update();};
    reset.onClick=function(){curl.text='0';start.text='100';end.text='100';direction.selection=0;update();};
    cancel.onClick=function(){win.close(0);};
    ok.onClick=function(){try{apply(values());accepted=true;win.close(1);}catch(e){message.text=e.message;ok.enabled=false;}};
    win.onShow=function(){update();};
    try{win.show();}catch(e){alert('処理できませんでした：'+e.message);}
    finally{if(!accepted){try{restore();}catch(e){alert('元のパスを復元できませんでした：'+e.message);}}}
}());
