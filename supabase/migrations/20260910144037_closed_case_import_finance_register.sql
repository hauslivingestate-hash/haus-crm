-- One-time import of the "Finance" workbook's Revenue tab (spreadsheet
-- 18dkl2l_3x2kLsS_kSAO7NdrnMPFos1rW_q6NjydT5uQ, gid 938641678) as read on 2026-09-10.
-- 60 register rows → 53 cases; the 7 'CO-' rows are the same deal credited to a second
-- agent and become closed_case_agent rows rather than cases.
--
-- Decisions taken here, so they are on record:
--   • Lead-ID / Code are linked only where the CRM has that row; the raw value is kept in
--     lead_ref / listing_ref either way, so nothing is silently dropped.
--   • Dates are imported as written. CC26-001 and CC26-004 show a transfer BEFORE the
--     signing; they are left that way and reported, not "fixed".
--   • CC26-026 (Fail): the register carries ฿264,000 on Game's row — the full 3% — and
--     ฿132,000 on Q's. Game's share is imported as ฿132,000 so the two shares sum to the
--     case, matching how every other co-broke pair in the register is written. It is a
--     failed case, so no revenue figure depends on the choice.
--   • Every other co-broke pair sums exactly to 3% of the price; the case total is the sum.
create temp table _reg (
  rid text, sales text, closing text, code text, dtype text, unit text, property text,
  price numeric, forecast numeric, status text, remark text, real numeric, transfer text,
  lead_ref text, buyer text, channel text, slip text, cash boolean, payout text
) on commit drop;

insert into _reg values
('CC25-001','Q','1/1/2026','HRP2003','Sale','89/185','บางกอก บูเลอวาร์ด สาทร-ปิ่นเกล้า 1',NULL,189000,'Pending','Flip',NULL,NULL,'L25-000',NULL,NULL,NULL,false,NULL),
('CC25-002','Stone','1/11/2025','HSLY002','Sale','81/74','อินิซิโอ 3 ปิ่นเกล้า - วงแหวน',3800000,57000,'Success','คอมรวม 114,000 โคกับพี่ปั๊บ สั่งจ่ายพี่ปั๊ป 37,050 บาท',57000,'28/11/2025',NULL,NULL,NULL,NULL,false,NULL),
('CO-CC25-002','Pup','1/11/2025','HSLY002','Sale','81/74','อินิซิโอ 3 ปิ่นเกล้า - วงแหวน',3800000,57000,'Success','คอมรวม 114,000 โคกับพี่ปั๊บ สั่งจ่ายพี่ปั๊ป 37,050 บาท',57000,'28/11/2025',NULL,NULL,NULL,NULL,false,'Pay'),
('CC25-003','Q','13/12/2025','TBGK001','Sale','197/85','บ้านกลางเมือง ดิ เอร่า ปิ่นเกล้า-จรัญ',5000000,150000,'Success','ลด Com เป็น 100,000',100000,'1/1/2026','L25-030',NULL,NULL,NULL,false,'Pay'),
('CC26-001','Q','20/1/2026','HRM5030','Sale','168/64','เดอะ ซิตี้ สะพานเจษฎาบดินทร์',10600000,318000,'Success',NULL,318000,'1/1/2026','L26-009','ต้น','Livinginsider',NULL,false,'Pay'),
('CC26-002','Mhow','21/1/2026',NULL,'Sale',NULL,NULL,NULL,95400,'Success','พี่โหมว ปิดกับ โด้ Hive sathron ห้อง 888/251 ชั้น 23',95400,'6/3/2026','L25-060','ปอนด์','Facebook Organic','S__28582001.jpg',false,'Pay'),
('CC26-003','Stone','21/1/2026','HRP1008','Sale','63/22','บางกอก บูเลอวาร์ด ซิกเนเจอร์ สาทร - ราชพฤกษ์',38000000,570000,'Success','โอนแล้ว ยังไม่ได้เงิน',570000,'3/4/2026','L26-030','อิฐ','อื่นๆ (โปรดระบุด้านล่าง)','ปิดเคส',false,'Pay'),
('CC26-004','Game','30/1/2026','HCYP034','Sale','58/381','สราญสิริ ชัยพฤกษ์ - แจ้งวัฒนะ',NULL,120000,'Success','เคสพี่รัฐ โอนเลย',120000,'2/1/2026','L26-062','พี่รัฐ','อื่นๆ (โปรดระบุด้านล่าง)',NULL,false,'Pay'),
('CC26-005','Game','1/2/2026','HCYP001','Sale','58/111','สราญสิริ ชัยพฤกษ์ - แจ้งวัฒนะ',NULL,193500,'Success',NULL,193500,'2/3/2026','L26-042','เอ๋','อื่นๆ (โปรดระบุด้านล่าง)','0156E976-A4E8-4D47-9C58-79412337C824.jpg',false,'Pay'),
('CC26-006','Q','21/2/2026','TNGM026','Sale','140/27','ฟลอร่า วงศ์สว่าง',5300000,159000,'Success','เซ็นเเล้ว รอโอน 4 เดือน 159,000 หักค่าส่วนกลาง 8,000',151000,'22/6/2026','L26-060','กนกพร','อื่นๆ (โปรดระบุด้านล่าง)','https://drive.google.com/drive/folders/1-BFb8UKhWtH6PZiQ2Lo4FvE9I_s5-r9a?usp=sharing',true,'Pay'),
('CC26-007','Q','6/3/2026','HRM5004','Sale','59/23','บางกอก บูเลอวาร์ด พระราม 5',9700000,291000,'Success','โอน 30 มีนา',291000,'30/3/2026','L26-148','ชล','Facebook Organic','ปิดเคส CC26-007',false,'Pay'),
('CC26-008','Game','13/3/2026','HRP3037','Sale','98/122','คาซ่า วิลล์ ราชพฤกษ์-แจ้งวัฒนะ',5150000,154400,'Success','Commission ที่ได้รับจริง ณ วันโอน 144,500 (เต็ม 154,500) 10,000 อยู่ในบัญชีเงินจอง - สลิปโอน',154000,'28/5/2026','L26-189','เหมียว','Facebook Organic','CC26-008',false,'Pay'),
('CC26-009','Stone','19/3/2026','HRP1020','Rent','295/90','ปริญญ์ สาทร - ราชพฤกษ์',90000,45000,'Success','ปิดเช่า เริ่ม 26 มีนาคม 2569 จบ 25 มีนาคม 2569 เคสโคนอก',45000,'22/3/2026','L26-125','ชัย','อื่นๆ (โปรดระบุด้านล่าง)','CC26-009',false,'Pay'),
('CC26-010','Mhow','4/4/2026','CPKS053','Sale','99/212','แอสปาย สาทร - ราชพฤกษ์',2100000,63000,'Success',NULL,63000,'27/4/2026','L26-285','ณัฐกานต์','Ddproperty','CC26-010_',false,'Pay'),
('CC26-011','Pup','5/4/2026','HKAL043','Sale','1109/126','เซนโทร สาทร-กัลปพฤกษ์',8400000,252000,'Success',NULL,252000,'28/4/2026','L26-307','ขออภัยครับ โปรไฟลล์เขาไม่ได้ลงชื่ิ','Livinginsider','CC26-011',false,'Pay'),
('CC26-012','Stone','8/4/2026','HRP1013','Sale','299/112','เศรษฐสิริ จรัญฯ - ปิ่นเกล้า 2',17500000,300672,'Success','299/112 ลูกค้า Referral ค่านิติ 10,000',290672,'30/6/2026',NULL,NULL,NULL,'https://drive.google.com/drive/folders/1qinO6JXQhncg8oQmBLDkor08DnSdwiWT?usp=sharing',true,'Pay'),
('CC26-013','Q','8/4/2026','CPDP006','Sale','259/368','เดอะ ไลน์ พหลโยธิน-ประดิพัทธ์',6750000,202500,'Success',NULL,202500,'28/5/2026','L26-217','ปีน','Livinginsider','https://drive.google.com/file/d/1OgvWqbcb8EQ8ML2U0bu5nQpvWYR7_vv0/view?usp=sharing',false,'Pay'),
('CC26-014','Game','10/4/2026','HRP3017','Sale','222/75','เพอร์เฟค เพลส รัตนาธิเบศร์-สถานีไทรม้า',8500000,255000,'Fail','ลิสต์นี้ ยังไม่ได้ทำการตลาดนะ เพิ่งหมดสัญญา Home',NULL,NULL,'L26-213','เมย์','อื่นๆ (โปรดระบุด้านล่าง)','https://drive.google.com/drive/folders/19kDdz2fiMng1Ip564j1X_oX0p-P5wbke?usp=drive_link',false,NULL),
('CC26-015','Golf','11/4/2026','TCWT018','Sale','26','ทาวน์เฮ้าส์ ประชานิเวศน์ 3',4000000,120000,'Success',NULL,120000,'29/5/2026','L26-379','ภูมิพัฒน์','Facebook Organic','https://drive.google.com/drive/folders/1LNbmiRkzi6cWbbbI_c1JFORPI5A3w1Ct?usp=sharing',false,'Pay'),
('CC26-016','Golf','14/4/2026','TPCC005','Sale','829/48','ทาวน์เฮ้าส์ ซอย ประชาชื่น 27',4100000,123000,'Fail','ลูกค้าคนที่จองคนแรกกู้ผ่านแล้ว แล้วลูกค้าเราไม่พร้อมวางเงินเพิ่ม เจ้าของโอนมัดจำคืนลูกค้าเรียบร้อยแล้ว',NULL,NULL,'L26-275','แจง','Facebook Organic',NULL,false,NULL),
('CC26-017','Game','19/4/2026','HRP3042','Sale','222/17','ฮาบิเทีย บอนด์ ราชพฤกษ์',4750000,85500,'Success','โคนอก ไม่มีใน Lead',85500,'22/5/2026',NULL,NULL,NULL,'CC26-017',false,'Pay'),
('CC26-019','Stone','24/4/2026','HRP1027','Sale','529/67','ไลฟ์ บางกอก บูเลอวาร์ด ราชพฤกษ์ - จรัญฯ',8100000,121500,'Success',NULL,121500,'28/5/2026','L26-194','แชมป์','Livinginsider','https://drive.google.com/drive/folders/1aKKI2fCWek-lknZyCU58hzbnYCaku_4O?usp=sharing',true,'Pay'),
('CO-CC26-019','Pup','24/4/2026','HRP1027','Sale','529/67','ไลฟ์ บางกอก บูเลอวาร์ด ราชพฤกษ์ - จรัญฯ',8100000,121500,'Success',NULL,121500,'28/5/2026',NULL,NULL,NULL,NULL,true,'Pay'),
('CC26-020','Game','25/4/2026','HRP3016','Sale','222/103','เพอร์เฟค เพลส รัตนาธิเบศร์-สถานีไทรม้า',8490000,254700,'Success',NULL,254700,'7/6/2026','L26-446','พิเชษ','ป้าย Offline','https://drive.google.com/drive/folders/1qCbAzSeGH3D5OQ8wmUNhNtzyQTQg3rpy?usp=sharing',false,'Pay'),
('CC26-021','Q','27/4/2026','HRM5021','Sale','188/15','ชีวารมย์ นครอินทร์',14000000,420000,'Success',NULL,420000,'5/6/2026','L26-457','ยุ้ย','Livinginsider','https://drive.google.com/drive/folders/1pKdvAN2IB1Hs9U2VpSBRaKT8kP-xhjXU?usp=sharing',true,'Pay'),
('CC26-018','Game','28/4/2026','TDMK007','Sale','99/66','นิว คอนเน็กซ์ เฮาส์ ดอนเมือง',5100000,153000,'Success',NULL,153000,'22/6/2026','L26-306','ขวัญชัย','Facebook Organic','https://drive.google.com/drive/folders/1SgSDGOdj1iQJT1IIt_3888a8jm4Z8qTS?usp=sharing',false,'Pay'),
('CC26-023','Golf','4/5/2026','TPCC009','Sale','564/18','ทาวน์เฮ้าส์ เทศบาลรังสรรเหนือ 14',4600000,138000,'Success','3% คือ 138,000 โดนหักจากค่าชดเชยให้ลูกค้า 20,000)',118000,'27/7/2026','L26-392','มุก','Ddproperty','https://drive.google.com/drive/folders/1PW2i1JAY4BHx1o9kKGAoONxXCwixMz20?usp=sharing',false,'Pay'),
('CC26-024','Stone','4/5/2026','HBGY001','Sale','188/57','เดอะ ลิฟท์วิ่ง 2 บ้านกล้วย - ไทรน้อย',3300000,99000,'Success',NULL,99000,'27/6/2026','L26-409','เอ','Facebook Organic','https://drive.google.com/drive/folders/18mZbnSzONDYokN6fJysJgUUxLzU3ZjW2?usp=sharing',true,'Pay'),
('CC26-025','Q','7/5/2026','HRP2048','Sale','35/340','สีวลี ราชพฤกษ์',7900000,237000,'Success',NULL,237000,'28/5/2026','L26-065','เล็ก','Facebook Organic','https://drive.google.com/drive/folders/1NPbjGsvX5P9Qx-VTk-nngiK4A7Je_eql?usp=sharing',true,'Pay'),
('CC26-026','Game','11/5/2026','HRP2003','Sale','89/185','บางกอก บูเลอวาร์ด สาทร-ปิ่นเกล้า 1',8800000,132000,'Fail',NULL,NULL,NULL,'ลูกค้านอก','ไม่พบข้อมูล','ไม่พบข้อมูล','https://drive.google.com/drive/folders/1uOuEdJvVYRTqiwekbrreQHnZGEitLYuV?usp=drive_link',false,NULL),
('CO-CC26-026','Q','11/5/2026','HRP2003','Sale','89/185','บางกอก บูเลอวาร์ด สาทร-ปิ่นเกล้า 1',8800000,132000,'Fail',NULL,NULL,NULL,NULL,NULL,NULL,'https://drive.google.com/drive/folders/1uOuEdJvVYRTqiwekbrreQHnZGEitLYuV?usp=drive_link',false,NULL),
('CC26-027','Stone','12/5/2026','HRP1036','Sale','24/98','ชวนชื่น รีเจนท์ ราชพฤกษ์',13888888,416666,'Success','ให้นิติ 5,000 / รปภ. 10,000 สรุปเหลือ 401,666 บาท ( เดี๋ยวสลิปโอนให้รปถ นิติ ส่งให้ทีหลัง )',401666,'13/7/2026','L26-406','ชัชชัย','อื่นๆ (โปรดระบุด้านล่าง)','https://drive.google.com/drive/folders/12uohxIqswTTMv1c5_38jD-MaohbM99Nn?usp=sharing',true,'Pay'),
('CC26-028','Game','17/5/2026','LRP2036','Sale',NULL,'ที่ดิน ซอยฉิมพลี28',3550000,53250,'Success',NULL,53250,'8/6/2026','L26-533','เบญจพร','Facebook Ad','https://drive.google.com/drive/folders/1ewRuvBitAs1v6vKaDaWY-IpLCpBHSh0V?usp=sharing',false,'Pay'),
('CO-CC26-028','Mhow','17/5/2026','LRP2036','Sale',NULL,'ที่ดิน ซอยฉิมพลี28',3550000,53250,'Success',NULL,53250,'8/6/2026',NULL,NULL,NULL,NULL,false,'Pay'),
('CC26-029','Golf','21/5/2026','HCWT049','Sale','99/17','บางกอก บูเลอวาร์ด ดอนเมือง-แจ้งวัฒนะ',16300000,489000,'Success','(เงินจองอยู่ที่บริษัท 500,000 โอนคืนเจ้าของ 11,000)',489000,'9/6/2026','L26-539','วิน','ป้าย Offline','https://drive.google.com/drive/folders/1hzhOSCCJOjq6wwW5yhD5pzrG4xb3FFEA?usp=sharing',false,'Pay'),
('CC26-030','Q','27/5/2026','HRM5074','Sale','999/127','เดอะ ซิตี้ พระราม 5 - ราชพฤกษ์ 2',7500000,225000,'Success',NULL,225000,'1/7/2026','L26-517','เบิร์ด','Facebook Ad','https://drive.google.com/drive/folders/1Lr3Et7y0qBYUZZn0oJjd3lSSy4u7VNvu?usp=sharing',true,'Pay'),
('CC26-031','Stone','1/6/2026','HRP1029','Rent','295/1','ปริญญ์ สาทร - ราชพฤกษ์',80000,40000,'Success','โคนอก เรารับเต็มและโอนให้เขา 50/50',40000,'9/6/2026','L26-620','เชอรี่','Livinginsider','https://drive.google.com/drive/folders/1gJeObW35gC8pefER3Kbv-0HAYf8ODFB0?usp=sharing',false,'Pay'),
('CC26-032','Pup','3/6/2026','HKAL050','Sale','87/64','นินญา กัลปพฤกษ์',9800000,294000,'Fail',NULL,NULL,NULL,'L26-655','โอเว่น','Ddproperty','https://drive.google.com/drive/folders/1rTnZqycXQcXTv6exYVjR3_Mbq-mdwIKm?usp=sharing',false,NULL),
('CC26-033','Pup','10/6/2026','HSSW064','Sale','429/220','เซนโทร สุขสวัสดิ์-พระราม3',5570000,167100,'Success',NULL,167100,'30/6/2026','L26-650','มด','Facebook Organic','https://drive.google.com/drive/folders/126pRZY0eXuLWbU_NyMGAZLeRu8BJ2aaH?usp=sharing',false,'Pay'),
('CC26-034','Mhow','12/6/2026','HPHU061','Sale','3/49','หมู่บ้านมัลลิกา กาญจนาภิเษก',4550000,136500,'Success',NULL,136500,'29/6/2026','L26-707','โอ๊ต','Livinginsider','https://drive.google.com/drive/folders/1j2ypLcfyoQ0ph0Yf568tnnYcM5QtyoDb?usp=sharing',false,'Pay'),
('CC26-035','Stone','18/6/2026','HRP1024','Rent','5/31','ธีรินทร์ ราชพฤกษ์',55000,55000,'Success','Com 55,000 แบ่งให้นิติ 3,000 บาท เหลือ 52,000 บาท',55000,'5/7/2026','L26-693','รัชชพล','Livinginsider','https://drive.google.com/drive/folders/1OIfjUu17O3Y1oZLYKVS7m1Nj4hbWhhJT?usp=sharing',true,'Pay'),
('CC26-036','Golf','20/6/2026','HCWT060','Sale','88/24','เดอะแพลนท์ แจ้งวัฒนะ',6600000,198000,'Success','เงินจองอยู่ที่บริษัท 10,000',198000,'24/6/2026','L26-739','รมย์มณี','Ddproperty','https://drive.google.com/drive/folders/1Soy_Aq4ZrKV90-GLktp2rJGooIc9xYmp?usp=sharing',false,'Pay'),
('CC26-037','Game','21/6/2026','HRP3054','Sale','99/229','คาซ่า วิลล์ ราชพฤกษ์-แจ้งวัฒนะ',5000000,150000,'Success','เงินสด 100,000 (อยู่ในบัญชีเงินจอง 50,000)',150000,'13/7/2026','L26-771','เอ๊ะ','Livinginsider','https://drive.google.com/drive/folders/11LAJXyzdwX6iCK27vzoB3ceVjO4Gd9Z_?usp=sharing',true,'Pay'),
('CC26-038','Stone','29/6/2026','HBGY009','Sale','889/103','บางกอก บูเลอวาร์ด เวสต์เกต',11000000,330000,'Success',NULL,330000,'10/9/2026','L26-741','โอ','Livinginsider','https://drive.google.com/drive/folders/15vS_CnbQJjFcTNpk-nFdQbZGFp5VKdeL?usp=sharing',true,NULL),
('CC26-039','Pup','8/7/2026','HKAL050','Sale','87/64','นินญา กัลปพฤกษ์',9700000,291000,'Success',NULL,291000,'7/8/2026','L26-802','ไนท์','ป้าย Offline','https://drive.google.com/drive/folders/1FjXk2EvIzPwqOdo6hkizRJpGjwHnxIiH?usp=sharing',false,'Pay'),
('CC26-040','Mhow','26/7/2026','HPHU104','Sale','22/132','บ้านมัณฑนา ทวีวัฒนา',4850000,145500,'Success','(ต้องให้นิติ 10%) ให้นิติ 14,550',130950,'27/8/2026','L26-925','ยศ','Livinginsider','https://drive.google.com/drive/folders/1ly0RehjC_A81Dx3UDXc_3U5Xlo39XghQ?usp=sharing',false,'Pending'),
('CC26-041','Pup','27/7/2026','HRM5093','Sale','99/9','เดอะ ซิตี้ พระราม 5 - ราชพฤกษ์ 2',9000000,135000,'Pending',NULL,NULL,NULL,'L26-728','กริช','Livinginsider',NULL,false,NULL),
('CO-CC26-041','Q','27/7/2026','HRM5093','Sale','99/9','เดอะ ซิตี้ พระราม 5 - ราชพฤกษ์ 2',9000000,135000,'Pending',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,NULL),
('CC26-042','Pup','27/7/2026','HSSW070','Sale','18/20','พลีโน่ สุขสวัสดิ์',4300000,129000,'Pending',NULL,NULL,NULL,'L26-946','โจ','Livinginsider',NULL,false,NULL),
('CC26-043','Golf','30/7/2026','CPCC078','Rent','689/399','ศุภาลัย เวอเรนด้า รัชวิภา - ประชาชื่น',25000,25000,'Success',NULL,25000,'2/8/2026','L26-942','ใบบัว','Property Hub','https://drive.google.com/drive/folders/1NNzqNPIdDcdGqwOmIgKDHNu3KxOAx-Tl?usp=sharing',false,'Pay'),
('CC26-044','Pup','29/7/2026','HKAL009','Sale','1109/144','เซนโทร สาทร-กัลปพฤกษ์',9700000,291000,'Success','291,000 - 5,000(นิติ) เหลือ 286,000',286000,'20/8/2026','L26-655','โอเว่น','Ddproperty','https://drive.google.com/drive/folders/1FF7WsqiedHEkR1L1YZkrMfzGLcVwHDb9?usp=sharing',false,'Pending'),
('CC26-045','Stone','28/7/2026','HRP1051','Sale','63/16','บางกอก บูเลอวาร์ด ซิกเนเจอร์ สาทร - ราชพฤกษ์',22000000,660000,'Fail',NULL,NULL,NULL,'L26-890','ทราย','Ddproperty','https://drive.google.com/drive/folders/1C2Kx2aNXwE0wxGvbONEoWWjLPrVNIvRv?usp=sharing',false,NULL),
('CC26-046','Mhow','6/8/2026','HSLY085','Sale','95/122','เพฟ ปิ่นเกล้า - ศาลายา',6200000,186000,'Pending',NULL,NULL,NULL,'L26-997','ทราย',NULL,NULL,false,NULL),
('CC26-047','Mhow','20/8/2026','CPKS051','Sale','98/25','ศุภาลัย ลอฟท์ สาทร - ราชพฤกษ์',3260000,97800,'Pending',NULL,NULL,NULL,'L26-1021','ฝน','Livinginsider',NULL,false,NULL),
('CC26-048','Stone','20/8/2026','HRP1026','Sale','21/60','บ้านสวนพุทธมณฑล สาย 1',6500000,97500,'Pending',NULL,NULL,NULL,'L26-1022','นุ','Facebook Organic',NULL,false,NULL),
('CO-CC26-048','Q','20/8/2026','HRP1026','Sale','21/60','บ้านสวนพุทธมณฑล สาย 1',6500000,97500,'Pending',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,NULL),
('CC26-049','Mhow','25/8/2026','CRM3011','Sale','31/250','เดอะ คีย์ สาทร - เจริญราษฎร์',4700000,141000,'Success',NULL,141000,'7/9/2026','L26-962','เมษา','Livinginsider','https://drive.google.com/drive/folders/100s6XX0W-BEVtjdduKggieNoc4qWufCi?usp=sharing',false,NULL),
('CC26-050','Stone','25/8/2026','HRM5010','Sale','54/146','เซนโทร ราชพฤกษ์',5400000,81000,'Pending',NULL,NULL,NULL,'L26-1084','ฟาง','Livinginsider',NULL,false,NULL),
('CO-CC26-050','Q','25/8/2026','HRM5010','Sale','54/146','เซนโทร ราชพฤกษ์',5400000,81000,'Pending',NULL,NULL,NULL,NULL,NULL,NULL,NULL,false,NULL),
('CC26-051','Mhow','10/9/2026','LPHU037','Sale',NULL,'กฤษดานคร ปิ่นเกล้า - พุทธมณฑลสาย 2',3200000,96000,'Pending',NULL,NULL,NULL,'L26-220','อันอัน','Livinginsider',NULL,false,NULL);

-- A nickname that matches no employee stops the whole import rather than guessing.
do $$
begin
  if exists (select 1 from _reg r left join main_1_hr h on h.nickname = r.sales where h.employee_code is null) then
    raise exception 'unmatched sales nickname in register';
  end if;
end $$;

insert into public.closed_case (
  case_id, lead_id, lead_ref, listing_id, listing_ref, deal_type, status,
  closing_date, transfer_date, closing_price, forecast_revenue, real_revenue,
  buyer_name, channel, unit_no, remark, is_cash, commission_slip, payout_status, created_by
)
select
  r.rid,
  (select l.lead_id from main_6_buyer_crm l where l.lead_id = r.lead_ref),
  r.lead_ref,
  (select m.listing_id from main_4_listing_database m where m.listing_id = r.code),
  r.code,
  lower(r.dtype),
  lower(r.status),
  to_date(r.closing, 'DD/MM/YYYY'),
  to_date(r.transfer, 'DD/MM/YYYY'),
  r.price,
  -- The case's figure is the sum of every credited share (one row for a solo deal).
  (select sum(x.forecast) from _reg x where x.rid = r.rid or x.rid = 'CO-' || r.rid),
  (select sum(x.real)     from _reg x where x.rid = r.rid or x.rid = 'CO-' || r.rid),
  r.buyer, r.channel, r.unit, r.remark, coalesce(r.cash, false), r.slip, r.payout,
  'import:finance-register-2026-09-10'
from _reg r
where r.rid not like 'CO-%';

insert into public.closed_case_agent (case_id, employee_code, is_primary, forecast_share, real_share)
select regexp_replace(r.rid, '^CO-', ''), h.employee_code, r.rid not like 'CO-%', r.forecast, r.real
from _reg r
join main_1_hr h on h.nickname = r.sales;;
